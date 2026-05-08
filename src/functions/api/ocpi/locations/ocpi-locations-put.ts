import { APIGatewayProxyResult } from 'aws-lambda';
import { APIGatewayProxyEventV2WithLambdaAuthorizer } from 'aws-lambda/trigger/api-gateway-proxy';
import { ErrorHandler } from '/opt/nodejs/api/error/api-error-handler';
import { OCPIAuthorizerContext } from '/opt/nodejs/api/base.model';
import {
  parseRequestBody,
  prepareOCPIResponse,
  withVersionCheck,
} from '/opt/nodejs/utils/api.utils';
import { Location, EVSE, Connector } from '/opt/nodejs/db/ocpi-locations/ocpi-locations.model';
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
      // e.g. PUT /locations/{country_code}/{party_id}/{location_id}
      //      PUT /locations/{country_code}/{party_id}/{location_id}/{evse_uid}
      //      PUT /locations/{country_code}/{party_id}/{location_id}/{evse_uid}/{connector_id}
      const pathCountryCode = event.pathParameters?.country_code;
      const pathPartyId = event.pathParameters?.party_id;
      const pathLocationId = event.pathParameters?.location_id;
      const pathEvseUid = event.pathParameters?.evse_uid;
      const pathConnectorId = event.pathParameters?.connector_id;

      // Only registered CPOs may push location data in their own namespace
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

      // Determine resource level and validate body accordingly
      if (pathEvseUid === undefined) {
        // ── Location-level PUT ────────────────────────────────────────────────
        const bodyResult = parseRequestBody<Location>(event.body);
        if (!bodyResult.ok) {
          console.warn(
            `[OCPI][locations/put] Rejected — invalid or missing request body from ${authContext.partnerId}`,
          );
          return bodyResult.error;
        }
        const location = bodyResult.data;

        if (
          location.country_code !== pathCountryCode ||
          location.party_id !== pathPartyId ||
          location.id !== pathLocationId
        ) {
          console.warn(
            `[OCPI][locations/put] Rejected — body mismatch for ${authContext.partnerId}: ` +
              `path=${pathCountryCode}/${pathPartyId}/${pathLocationId}, ` +
              `body=${location.country_code}/${location.party_id}/${location.id}`,
          );
          return ErrorHandler.handleBadRequestError(
            2001,
            'Identifiers in path and body do not match.',
          );
        }

        // TODO: S3 and SQS ingestion
        console.info(
          `[OCPI][locations/put] Location ${location.country_code}/${location.party_id}/${location.id} received from ${authContext.partnerId}`,
        );
      } else if (pathConnectorId === undefined) {
        // ── EVSE-level PUT ────────────────────────────────────────────────────
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

        // TODO: S3 and SQS ingestion
        console.info(
          `[OCPI][locations/put] EVSE ${pathCountryCode}/${pathPartyId}/${pathLocationId}/${evse.uid} received from ${authContext.partnerId}`,
        );
      } else {
        // ── Connector-level PUT ───────────────────────────────────────────────
        const bodyResult = parseRequestBody<Connector>(event.body);
        if (!bodyResult.ok) {
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

        // TODO: S3 and SQS ingestion
        console.info(
          `[OCPI][locations/put] Connector ${pathCountryCode}/${pathPartyId}/${pathLocationId}/${pathEvseUid}/${connector.id} received from ${authContext.partnerId}`,
        );
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
