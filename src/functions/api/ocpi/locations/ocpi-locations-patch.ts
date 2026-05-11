import { APIGatewayProxyResult } from 'aws-lambda';
import { APIGatewayProxyEventV2WithLambdaAuthorizer } from 'aws-lambda/trigger/api-gateway-proxy';
import { ErrorHandler } from '/opt/nodejs/api/error/api-error-handler';
import { OCPIAuthorizerContext } from '/opt/nodejs/api/base.model';
import {
  parseRequestBody,
  prepareOCPIResponse,
  withVersionCheck,
} from '/opt/nodejs/utils/api.utils';
import {
  assertNotBootstrap,
  assertOwnership,
  assertRole,
} from '/opt/nodejs/utils/ocpi-guards';
import {
  publishIngestionEvent,
  putRawToS3,
} from '/opt/nodejs/utils/ingestion.utils';
import { Aws } from '/opt/nodejs/aws.constants';

export const handler = withVersionCheck(
  async (
    event: APIGatewayProxyEventV2WithLambdaAuthorizer<OCPIAuthorizerContext>,
    authContext: OCPIAuthorizerContext,
    ocpiVersion: string,
  ): Promise<APIGatewayProxyResult> => {
    try {
      // Identifiers from the request URL path — e.g. PATCH /locations/{country_code}/{party_id}/{location_id}
      const pathCountryCode = event.pathParameters?.country_code;
      const pathPartyId = event.pathParameters?.party_id;
      const pathLocationId = event.pathParameters?.location_id;

      // Only registered CPOs may push partial location updates in their own namespace; bootstrap tokens and other roles are rejected
      const guardError =
        assertNotBootstrap(authContext, 'locations/patch') ??
        assertRole(authContext, 'CPO', 'locations/patch') ??
        assertOwnership(
          authContext,
          pathCountryCode,
          pathPartyId,
          'locations/patch',
        );
      if (guardError) {
        return guardError;
      }

      // PATCH body is a partial object — parse as a generic map to avoid enforcing
      // all mandatory fields, but last_updated MUST be present per OCPI spec
      const bodyResult = parseRequestBody<Record<string, unknown>>(event.body);
      if (!bodyResult.ok) {
        console.warn(
          `[OCPI][locations/patch] Rejected — invalid or missing request body from ${authContext.partnerId}`,
        );
        return bodyResult.error;
      }
      const patch = bodyResult.data;

      if (
        typeof patch['last_updated'] !== 'string' ||
        patch['last_updated'].length === 0
      ) {
        console.warn(
          `[OCPI][locations/patch] Rejected — missing last_updated in body from ${authContext.partnerId}`,
        );
        return ErrorHandler.handleBadRequestError(
          2001,
          'Partial updates must include the last_updated field.',
        );
      }

      const receivedAt = new Date().toISOString();

      // Persist the raw location patch payload to S3 as the canonical ingestion record
      let s3Key: string;
      try {
        s3Key = await putRawToS3(
          patch,
          'locations',
          'PATCH',
          pathCountryCode!,
          pathPartyId!,
          pathLocationId!,
          receivedAt,
        );
        console.info(
          `[OCPI][locations/patch] Raw location patch stored to s3://${Aws.rawDataBucketName}/${s3Key} from ${authContext.partnerId}`,
        );
      } catch (err) {
        console.error(
          `[OCPI][locations/patch] S3 write failed for ${pathCountryCode}/${pathPartyId}/${pathLocationId} from ${authContext.partnerId}:`,
          err,
        );
        return ErrorHandler.handleError(err);
      }

      // Publish an ingestion event to SQS so downstream processors can pick up the S3 object
      try {
        await publishIngestionEvent({
          action: 'PATCH',
          type: 'locations',
          object_id: pathLocationId!,
          country_code: pathCountryCode!,
          party_id: pathPartyId!,
          ocpi_version: ocpiVersion,
          received_at: receivedAt,
          raw: {
            bucket: Aws.rawDataBucketName,
            key: s3Key,
          },
        });
        console.info(
          `[OCPI][locations/patch] Ingested location patch ${pathCountryCode}/${pathPartyId}/${pathLocationId} from ${authContext.partnerId} → s3:${s3Key}`,
        );
      } catch (err) {
        console.error(
          `[OCPI][locations/patch] SQS publish failed — orphaned S3 object at s3://${Aws.rawDataBucketName}/${s3Key} from ${authContext.partnerId}:`,
          err,
        );
        return ErrorHandler.handleError(err);
      }

      // PATCH returns no data per OCPI spec
      return prepareOCPIResponse(null);
    } catch (err) {
      console.error(
        `[OCPI][locations/patch] Unexpected error for party ${authContext.partnerId}:`,
        err,
      );
      return ErrorHandler.handleError(err);
    }
  },
);
