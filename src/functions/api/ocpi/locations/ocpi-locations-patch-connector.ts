import { APIGatewayProxyResult } from 'aws-lambda';
import { APIGatewayProxyEventV2WithLambdaAuthorizer } from 'aws-lambda/trigger/api-gateway-proxy';
import { ErrorHandler } from '/opt/nodejs/api/error/api-error-handler';
import { OCPIAuthorizerContext } from '/opt/nodejs/api/base.model';
import { prepareOCPIResponse } from '/opt/nodejs/utils/api.utils';
import {
  assertNotBootstrap,
  assertOwnership,
  assertRole,
  parseRequestBody,
  withVersionCheck,
} from '/opt/nodejs/utils/ocpi-guards';
import { publishIngestionEvent } from '/opt/nodejs/aws/sqs';

export const handler = withVersionCheck(
  (event, auth) =>
    assertNotBootstrap(auth, 'locations/patch') ??
    assertRole(auth, 'CPO', 'locations/patch') ??
    assertOwnership(auth, event.pathParameters?.country_code, event.pathParameters?.party_id, 'locations/patch'),
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

      // PATCH body is a partial object — parse as a generic map to avoid enforcing all mandatory fields, but last_updated MUST be present per OCPI spec
      const bodyResult = parseRequestBody<Record<string, unknown>>(event.body);
      if (!bodyResult.success) {
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
      const objectId = `${pathLocationId}*${pathEvseUid}*${pathConnectorId}`;

      // Publish ingestion event to SQS — delta embedded directly, no S3 write for PATCH
      try {
        await publishIngestionEvent({
          action: 'PATCH',
          type: 'connector',
          object_id: objectId,
          country_code: pathCountryCode!,
          party_id: pathPartyId!,
          ocpi_version: ocpiVersion,
          received_at: receivedAt,
          raw: null,
          delta: patch,
        });
        console.info(
          `[OCPI][locations/patch] Ingested connector patch ${pathCountryCode}/${pathPartyId}/${pathLocationId}/${pathEvseUid}/${pathConnectorId} from ${authContext.partnerId}`,
        );
      } catch (err) {
        console.error(
          `[OCPI][locations/patch] SQS publish failed for ${pathCountryCode}/${pathPartyId}/${pathLocationId}/${pathEvseUid}/${pathConnectorId} from ${authContext.partnerId}:`,
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
