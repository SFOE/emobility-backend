import { APIGatewayProxyResult } from 'aws-lambda';
import { APIGatewayProxyEventV2WithLambdaAuthorizer } from 'aws-lambda/trigger/api-gateway-proxy';
import { ErrorHandler } from '/opt/nodejs/api/error/api-error-handler';
import { OCPIAuthorizerContext } from '/opt/nodejs/api/base.model';
import { parseRequestBody, prepareOCPIResponse, withVersionCheck } from '/opt/nodejs/utils/api.utils';
import { Tariff } from '/opt/nodejs/db/ocpi-tariffs/ocpi-tariffs.model';

export const handler = withVersionCheck(
  async (
    event: APIGatewayProxyEventV2WithLambdaAuthorizer<OCPIAuthorizerContext>,
    authContext: OCPIAuthorizerContext,
  ): Promise<APIGatewayProxyResult> => {
    try {
      // Only registered parties may push tariffs — bootstrap tokens are not permitted here
      if (authContext.isBootstrap) {
        console.warn(`[OCPI][tarrifs/put] Rejected — bootstrap token used by ${authContext.partnerId}`);
        return ErrorHandler.handleBadRequestError(2000, 'Bootstrap tokens are not allowed for tariff operations.', 405);
      }

      // Parse and validate the incoming tariff payload
      const bodyResult = parseRequestBody<Tariff>(event.body);
      if (!bodyResult.ok) {
        console.warn(`[OCPI][tarrifs/put] Rejected — invalid or missing request body from ${authContext.partnerId}`);
        return bodyResult.error;
      }
      const tariff = bodyResult.data;

      // Enforce Client Owned Objects: path params must match the body identifiers
      const pathCountryCode = event.pathParameters?.country_code;
      const pathPartyId = event.pathParameters?.party_id;
      const pathTariffId = event.pathParameters?.tariff_id;

      if (
        tariff.country_code !== pathCountryCode ||
        tariff.party_id !== pathPartyId ||
        tariff.id !== pathTariffId
      ) {
        const partyRef = `${pathCountryCode}/${pathPartyId}/${pathTariffId}`;
        console.warn(`[OCPI][tarrifs/put] Rejected — ownership mismatch for ${authContext.partnerId}: path=${partyRef}, body=${tariff.country_code}/${tariff.party_id}/${tariff.id}`);
        return ErrorHandler.handleBadRequestError(2001, 'Tariff identifiers in path and body do not match.');
      }

      // Data Lakehouse connection not yet available — tariff received and acknowledged
      console.info(`[OCPI][tarrifs/put] Received tariff ${tariff.country_code}/${tariff.party_id}/${tariff.id} from ${authContext.partnerId}`);

      // PUT returns no data per OCPI spec
      return prepareOCPIResponse(null);
    } catch (err) {
      console.error(`[OCPI][tarrifs/put] Unexpected error for party ${authContext.partnerId}:`, err);
      return ErrorHandler.handleError(err);
    }
  },
);
