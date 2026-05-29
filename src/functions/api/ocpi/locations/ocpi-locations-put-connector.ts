import { APIGatewayProxyResult } from 'aws-lambda';
import { APIGatewayProxyEventV2WithLambdaAuthorizer } from 'aws-lambda/trigger/api-gateway-proxy';
import { ErrorHandler } from '/opt/nodejs/api/error/api-error-handler';
import { OCPIAuthorizerContext } from '/opt/nodejs/api/base.model';
import { prepareOCPIResponse } from '/opt/nodejs/utils/api.utils';
import { Connector } from '/opt/nodejs/modules/ocpi-locations/ocpi-locations.model';
import {
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
    assertNotBootstrap(auth, 'locations/put') ??
    assertRole(auth, 'CPO', 'locations/put') ??
    assertOwnership(auth, event.pathParameters?.country_code, event.pathParameters?.party_id, 'locations/put'),
)(async (
    event: APIGatewayProxyEventV2WithLambdaAuthorizer<OCPIAuthorizerContext>,
    authContext: OCPIAuthorizerContext,
    ocpiVersion: string,
  ): Promise<APIGatewayProxyResult> => {
    try {
      const pathCountryCode = event.pathParameters?.country_code;
      const pathPartyId = event.pathParameters?.party_id;
      const pathLocationId = event.pathParameters?.location_id;
      const pathEvseUid = event.pathParameters?.evse_uid;
      const pathConnectorId = event.pathParameters?.connector_id;

      // Parse and validate the incoming connector payload
      const bodyResult = parseRequestBody<Connector>(event.body);
      if (!bodyResult.success) {
        console.warn(
          `[OCPI][locations/put] Rejected — invalid or missing Connector body from ${authContext.partnerId}`,
        );
        return bodyResult.error;
      }
      const connector = bodyResult.data;

      if (connector.id !== pathConnectorId) {
        console.warn(
          `[OCPI][locations/put] Rejected — Connector id mismatch for ${authContext.partnerId}: ` +
            `path=${pathConnectorId}, body=${connector.id}`,
        );
        return ErrorHandler.handleBadRequestError(
          2001,
          'Connector id in path and body do not match.',
        );
      }

      const receivedAt = new Date().toISOString();
      const objectId = `${pathLocationId}*${pathEvseUid}*${connector.id}`;

      // Persist the raw connector payload to S3 as the canonical ingestion record
      let s3Key: string;
      try {
        s3Key = await putRawToS3(
          connector,
          'connector',
          'PUT',
          pathCountryCode!,
          pathPartyId!,
          [`location_id=${pathLocationId}`, `evse_uid=${pathEvseUid}`, `connector_id=${connector.id}`],
          receivedAt,
        );
        console.info(
          `[OCPI][locations/put] Raw connector stored to s3://${Aws.rawDataBucketName}/${s3Key} from ${authContext.partnerId}`,
        );
      } catch (err) {
        console.error(
          `[OCPI][locations/put] S3 write failed for ${pathCountryCode}/${pathPartyId}/${pathLocationId}/${pathEvseUid}/${connector.id} from ${authContext.partnerId}:`,
          err,
        );
        return ErrorHandler.handleError(err);
      }

      // Publish an ingestion event to SQS so downstream processors can pick up the S3 object
      try {
        await publishIngestionEvent({
          action: 'PUT',
          type: 'connector',
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
          `[OCPI][locations/put] Ingested connector ${pathCountryCode}/${pathPartyId}/${pathLocationId}/${pathEvseUid}/${connector.id} from ${authContext.partnerId} → s3:${s3Key}`,
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
  });
