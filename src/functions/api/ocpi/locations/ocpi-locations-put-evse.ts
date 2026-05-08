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

export const handler = withVersionCheck(
  async (
    event: APIGatewayProxyEventV2WithLambdaAuthorizer<OCPIAuthorizerContext>,
    authContext: OCPIAuthorizerContext,
    _ocpiVersion: string,
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

      // TODO: persist raw EVSE payload to S3 and publish ingestion event to SQS
      console.info(
        `[OCPI][locations/put] EVSE ${pathCountryCode}/${pathPartyId}/${pathLocationId}/${evse.uid} received from ${authContext.partnerId}`,
      );

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
