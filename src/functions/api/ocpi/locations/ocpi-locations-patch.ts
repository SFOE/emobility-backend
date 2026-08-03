import { APIGatewayProxyResult } from 'aws-lambda';
import { APIGatewayProxyEventV2WithLambdaAuthorizer } from 'aws-lambda/trigger/api-gateway-proxy';
import { ErrorHandler } from '/opt/nodejs/api/error/api-error-handler';
import { OCPIAuthorizerContext } from '/opt/nodejs/api/base.model';
import { prepareOCPIResponse } from '/opt/nodejs/utils/api.utils';
import {
  assertNotBootstrap,
  assertOwnership,
  assertRole,
  assertValidPatchLastUpdated,
  parseRequestBody,
  withVersionCheck,
} from '/opt/nodejs/utils/ocpi-guards';
import { putRawToS3 } from '/opt/nodejs/aws/s3';
import { publishIngestionEvent } from '/opt/nodejs/aws/sqs';
import { Aws } from '/opt/nodejs/aws/constants';

export const handler = withVersionCheck(
  (_event, auth) =>
    assertNotBootstrap(auth, 'locations/patch') ??
    assertRole(auth, 'locations/patch') ??
    assertOwnership(auth, 'locations/patch'),
)(async (
    event: APIGatewayProxyEventV2WithLambdaAuthorizer<OCPIAuthorizerContext>,
    authContext: OCPIAuthorizerContext,
    ocpiVersion: string,
  ): Promise<APIGatewayProxyResult> => {
    try {
      const pathCountryCode = event.pathParameters?.country_code;
      const pathPartyId = event.pathParameters?.party_id;
      const pathLocationId = event.pathParameters?.location_id;

      // PATCH body is a partial object — parse as generic map, but last_updated MUST be present per OCPI spec
      const bodyResult = parseRequestBody<Record<string, unknown>>(event.body);
      if (!bodyResult.success) {
        console.warn(
          `[OCPI][locations/patch] Rejected — invalid or missing request body from ${authContext.partnerId}`,
        );
        return bodyResult.error;
      }
      const patch = bodyResult.data;

      const lastUpdatedError = assertValidPatchLastUpdated(patch, authContext.partnerId, 'locations/patch');
      if (lastUpdatedError) { return lastUpdatedError; }

      const receivedAt = new Date().toISOString();

      // Persist the raw patch payload to S3 as the canonical ingestion record
      let s3Key: string;
      try {
        s3Key = await putRawToS3(
          patch,
          'locations',
          'PATCH',
          pathCountryCode!,
          pathPartyId!,
          [`location_id=${pathLocationId}`],
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
  });
