import { APIGatewayProxyResult } from 'aws-lambda';
import { APIGatewayProxyEventV2WithLambdaAuthorizer } from 'aws-lambda/trigger/api-gateway-proxy';
import { ErrorHandler } from '/opt/nodejs/api/error/api-error-handler';
import { OCPIAuthorizerContext } from '/opt/nodejs/api/base.model';
import {
  parseRequestBody,
  prepareOCPIResponse,
  withVersionCheck,
} from '/opt/nodejs/utils/api.utils';
import { EVSE } from '/opt/nodejs/db/ocpi-locations/ocpi-locations.model';
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
      // Identifiers from the request URL path — e.g. PUT /locations/{country_code}/{party_id}/{location_id}/{evse_uid}
      const pathCountryCode = event.pathParameters?.country_code;
      const pathPartyId = event.pathParameters?.party_id;
      const pathLocationId = event.pathParameters?.location_id;
      const pathEvseUid = event.pathParameters?.evse_uid;

      // Only registered CPOs may push EVSEs in their own namespace; bootstrap tokens and other roles are rejected
      const guardError =
        assertNotBootstrap(authContext, 'locations/put') ??
        assertRole(authContext, 'CPO', 'locations/put') ??
        assertOwnership(
          authContext,
          pathCountryCode,
          pathPartyId,
          'locations/put',
        );
      if (guardError) {
        return guardError;
      }

      // Parse and validate the incoming EVSE payload
      const bodyResult = parseRequestBody<EVSE>(event.body);
      if (!bodyResult.ok) {
        console.warn(
          `[OCPI][locations/put] Rejected — invalid or missing EVSE body from ${authContext.partnerId}`,
        );
        return bodyResult.error;
      }
      const evse = bodyResult.data;

      if (evse.uid !== pathEvseUid) {
        console.warn(
          `[OCPI][locations/put] Rejected — EVSE uid mismatch for ${authContext.partnerId}: ` +
            `path=${pathEvseUid}, body=${evse.uid}`,
        );
        return ErrorHandler.handleBadRequestError(
          2001,
          'EVSE uid in path and body do not match.',
        );
      }

      const receivedAt = new Date().toISOString();
      const objectId = `${pathLocationId}_${evse.uid}`;

      // Persist the raw EVSE payload to S3 as the canonical ingestion record
      let s3Key: string;
      try {
        s3Key = await putRawToS3(
          evse,
          'locations',
          'PUT',
          pathCountryCode!,
          pathPartyId!,
          objectId,
          receivedAt,
        );
        console.info(
          `[OCPI][locations/put] Raw EVSE stored to s3://${Aws.rawDataBucketName}/${s3Key} from ${authContext.partnerId}`,
        );
      } catch (err) {
        console.error(
          `[OCPI][locations/put] S3 write failed for ${pathCountryCode}/${pathPartyId}/${pathLocationId}/${evse.uid} from ${authContext.partnerId}:`,
          err,
        );
        return ErrorHandler.handleError(err);
      }

      // Publish an ingestion event to SQS so downstream processors can pick up the S3 object
      try {
        await publishIngestionEvent({
          action: 'PUT',
          type: 'locations',
          object_id: objectId,
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
          `[OCPI][locations/put] Ingested EVSE ${pathCountryCode}/${pathPartyId}/${pathLocationId}/${evse.uid} from ${authContext.partnerId} → s3:${s3Key}`,
        );
      } catch (err) {
        console.error(
          `[OCPI][locations/put] SQS publish failed — orphaned S3 object at s3://${Aws.rawDataBucketName}/${s3Key} from ${authContext.partnerId}:`,
          err,
        );
        return ErrorHandler.handleError(err);
      }

      // PUT returns no data per OCPI spec
      return prepareOCPIResponse(null);
    } catch (err) {
      console.error(
        `[OCPI][locations/put] Unexpected error for party ${authContext.partnerId}:`,
        err,
      );
      return ErrorHandler.handleError(err);
    }
  },
);
