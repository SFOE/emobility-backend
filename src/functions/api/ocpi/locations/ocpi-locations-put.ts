import { APIGatewayProxyResult } from 'aws-lambda';
import { APIGatewayProxyEventV2WithLambdaAuthorizer } from 'aws-lambda/trigger/api-gateway-proxy';
import { ErrorHandler } from '/opt/nodejs/api/error/api-error-handler';
import { OCPIAuthorizerContext } from '/opt/nodejs/api/base.model';
import {
  parseRequestBody,
  prepareOCPIResponse,
  withVersionCheck,
} from '/opt/nodejs/utils/api.utils';
import { Location } from '/opt/nodejs/db/ocpi-locations/ocpi-locations.model';
import {
  assertBodyConsistency,
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
      // Identifiers from the request URL path — e.g. PUT /locations/{country_code}/{party_id}/{location_id}
      const pathCountryCode = event.pathParameters?.country_code;
      const pathPartyId = event.pathParameters?.party_id;
      const pathLocationId = event.pathParameters?.location_id;

      // Only registered CPOs may push locations in their own namespace; bootstrap tokens and other roles are rejected
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

      // Parse and validate the incoming location payload
      const bodyResult = parseRequestBody<Location>(event.body);
      if (!bodyResult.ok) {
        console.warn(
          `[OCPI][locations/put] Rejected — invalid or missing request body from ${authContext.partnerId}`,
        );
        return bodyResult.error;
      }
      const location = bodyResult.data;

      // Ensure path identifiers match the body and contain no characters that would break S3 key paths
      const bodyError = assertBodyConsistency(
        location,
        pathCountryCode,
        pathPartyId,
        pathLocationId,
        'locations/put',
        authContext.partnerId,
      );
      if (bodyError) {return bodyError;}

      const receivedAt = new Date().toISOString();

      // Persist the raw location payload to S3 as the canonical ingestion record
      let s3Key: string;
      try {
        s3Key = await putRawToS3(
          location,
          'locations',
          'PUT',
          location.country_code,
          location.party_id,
          location.id,
          receivedAt,
        );
        console.info(
          `[OCPI][locations/put] Raw location stored to s3://${Aws.rawDataBucketName}/${s3Key} from ${authContext.partnerId}`,
        );
      } catch (err) {
        console.error(
          `[OCPI][locations/put] S3 write failed for ${location.country_code}/${location.party_id}/${location.id} from ${authContext.partnerId}:`,
          err,
        );
        return ErrorHandler.handleError(err);
      }

      // Publish an ingestion event to SQS so downstream processors can pick up the S3 object
      try {
        await publishIngestionEvent({
          action: 'PUT',
          type: 'locations',
          object_id: location.id,
          country_code: location.country_code,
          party_id: location.party_id,
          ocpi_version: ocpiVersion,
          received_at: receivedAt,
          raw: {
            bucket: Aws.rawDataBucketName,
            key: s3Key,
          },
          delta: null,
        });
        console.info(
          `[OCPI][locations/put] Ingested location ${location.country_code}/${location.party_id}/${location.id} from ${authContext.partnerId} → s3:${s3Key}`,
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
