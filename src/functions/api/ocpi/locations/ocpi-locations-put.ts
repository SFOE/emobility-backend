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

      // TODO: persist raw location payload to S3 and publish ingestion event to SQS
      console.info(
        `[OCPI][locations/put] Location ${location.country_code}/${location.party_id}/${location.id} received from ${authContext.partnerId}`,
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
