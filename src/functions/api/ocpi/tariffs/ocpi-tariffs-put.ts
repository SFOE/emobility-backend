import { APIGatewayProxyResult } from 'aws-lambda';
import { APIGatewayProxyEventV2WithLambdaAuthorizer } from 'aws-lambda/trigger/api-gateway-proxy';
import { ErrorHandler } from '/opt/nodejs/api/error/api-error-handler';
import { OCPIAuthorizerContext } from '/opt/nodejs/api/base.model';
import { prepareOCPIResponse } from '/opt/nodejs/utils/api.utils';
import { Tariff } from '/opt/nodejs/modules/ocpi-tariffs/ocpi-tariffs.model';
import {
  assertBodyConsistency,
  assertNotBootstrap,
  assertOwnership,
  assertRole,
  parseRequestBody,
  withVersionCheck,
} from '/opt/nodejs/utils/ocpi-guards';
import { putRawToS3 } from '/opt/nodejs/aws/s3';
import { publishIngestionEvent } from '/opt/nodejs/aws/sqs';
import { Aws } from '/opt/nodejs/aws/constants';

export const handler = withVersionCheck(
  (event, auth) =>
    assertNotBootstrap(auth, 'tariffs/put') ??
    assertRole(auth, 'CPO', 'tariffs/put') ??
    assertOwnership(auth, event.pathParameters?.country_code, event.pathParameters?.party_id, 'tariffs/put'),
)(async (
    event: APIGatewayProxyEventV2WithLambdaAuthorizer<OCPIAuthorizerContext>,
    authContext: OCPIAuthorizerContext,
    ocpiVersion: string,
  ): Promise<APIGatewayProxyResult> => {
    try {
      const pathCountryCode = event.pathParameters?.country_code;
      const pathPartyId = event.pathParameters?.party_id;
      const pathTariffId = event.pathParameters?.tariff_id;

      // Parse and validate the incoming tariff payload
      const bodyResult = parseRequestBody<Tariff>(event.body);
      if (!bodyResult.success) {
        console.warn(
          `[OCPI][tariffs/put] Rejected — invalid or missing request body from ${authContext.partnerId}`,
        );
        return bodyResult.error;
      }
      const tariff = bodyResult.data;

      // Ensure path identifiers match the body and contain no characters that would break S3 key paths
      const bodyError = assertBodyConsistency(
        tariff,
        pathCountryCode,
        pathPartyId,
        pathTariffId,
        'tariffs/put',
        authContext.partnerId,
      );
      if (bodyError) {return bodyError;}

      const receivedAt = new Date().toISOString();

      // Persist the raw tariff payload to S3 as the canonical ingestion record
      let s3Key: string;
      try {
        s3Key = await putRawToS3(
          tariff,
          'tariffs',
          'PUT',
          tariff.country_code,
          tariff.party_id,
          [`tariff_id=${tariff.id}`],
          receivedAt,
        );
        console.info(
          `[OCPI][tariffs/put] Raw tariff stored to s3://${Aws.rawDataBucketName}/${s3Key} from ${authContext.partnerId}`,
        );
      } catch (err) {
        console.error(
          `[OCPI][tariffs/put] S3 write failed for ${tariff.country_code}/${tariff.party_id}/${tariff.id} from ${authContext.partnerId}:`,
          err,
        );
        return ErrorHandler.handleError(err);
      }

      // Publish an ingestion event to SQS so downstream processors can pick up the S3 object
      try {
        await publishIngestionEvent({
          action: 'PUT',
          type: 'tariffs',
          object_id: tariff.id,
          country_code: tariff.country_code,
          party_id: tariff.party_id,
          ocpi_version: ocpiVersion,
          received_at: receivedAt,
          raw: {
            bucket: Aws.rawDataBucketName,
            key: s3Key,
          },
        });
        console.info(
          `[OCPI][tariffs/put] Ingested tariff ${tariff.country_code}/${tariff.party_id}/${tariff.id} from ${authContext.partnerId} → s3:${s3Key}`,
        );
      } catch (err) {
        console.error(
          `[OCPI][tariffs/put] SQS publish failed — orphaned S3 object at s3://${Aws.rawDataBucketName}/${s3Key} from ${authContext.partnerId}:`,
          err,
        );
        return ErrorHandler.handleError(err);
      }

      // PUT returns no data per OCPI spec
      return prepareOCPIResponse(null);
    } catch (err) {
      console.error(
        `[OCPI][tariffs/put] Unexpected error for party ${authContext.partnerId}:`,
        err,
      );
      return ErrorHandler.handleError(err);
    }
  });
