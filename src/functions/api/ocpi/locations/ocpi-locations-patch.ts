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

export const handler = withVersionCheck(
  async (
    event: APIGatewayProxyEventV2WithLambdaAuthorizer<OCPIAuthorizerContext>,
    authContext: OCPIAuthorizerContext,
    _ocpiVersion: string,
  ): Promise<APIGatewayProxyResult> => {
    try {
      // Identifiers from the request URL path
      // e.g. PATCH /locations/{country_code}/{party_id}/{location_id}
      //      PATCH /locations/{country_code}/{party_id}/{location_id}/{evse_uid}
      //      PATCH /locations/{country_code}/{party_id}/{location_id}/{evse_uid}/{connector_id}
      const pathCountryCode = event.pathParameters?.country_code;
      const pathPartyId = event.pathParameters?.party_id;
      const pathLocationId = event.pathParameters?.location_id;
      const pathEvseUid = event.pathParameters?.evse_uid;
      const pathConnectorId = event.pathParameters?.connector_id;

      // Only registered CPOs may push partial location updates in their own namespace
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

      if (typeof patch['last_updated'] !== 'string' || patch['last_updated'].length === 0) {
        console.warn(
          `[OCPI][locations/patch] Rejected — missing last_updated in body from ${authContext.partnerId}`,
        );
        return ErrorHandler.handleBadRequestError(
          2001,
          'Partial updates must include the last_updated field.',
        );
      }

      // Determine resource level for logging
      const resourcePath =
        pathEvseUid === undefined
          ? `${pathCountryCode}/${pathPartyId}/${pathLocationId}`
          : pathConnectorId === undefined
            ? `${pathCountryCode}/${pathPartyId}/${pathLocationId}/${pathEvseUid}`
            : `${pathCountryCode}/${pathPartyId}/${pathLocationId}/${pathEvseUid}/${pathConnectorId}`;

      // TODO: S3 and SQS ingestion
      console.info(
        `[OCPI][locations/patch] Partial update for ${resourcePath} received from ${authContext.partnerId}`,
      );

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
