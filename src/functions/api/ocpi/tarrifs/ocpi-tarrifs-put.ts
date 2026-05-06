import { APIGatewayProxyResult } from 'aws-lambda';
import { APIGatewayProxyEventV2WithLambdaAuthorizer } from 'aws-lambda/trigger/api-gateway-proxy';
import { ErrorHandler } from '/opt/nodejs/api/error/api-error-handler';
import { OCPIAuthorizerContext } from '/opt/nodejs/api/base.model';
import { parseRequestBody, prepareOCPIResponse, withVersionCheck } from '/opt/nodejs/utils/api.utils';
import { Tariff } from '/opt/nodejs/db/ocpi-tariffs/ocpi-tariffs.model';
import { assertBodyConsistency, assertNotBootstrap, assertOwnership, assertRole } from '/opt/nodejs/utils/ocpi-guards';

export const handler = withVersionCheck(
  async (
    event: APIGatewayProxyEventV2WithLambdaAuthorizer<OCPIAuthorizerContext>,
    authContext: OCPIAuthorizerContext,
  ): Promise<APIGatewayProxyResult> => {
    try {
      const pathCountryCode = event.pathParameters?.country_code;
      const pathPartyId = event.pathParameters?.party_id;
      const pathTariffId = event.pathParameters?.tariff_id;

      const guardError = 
        assertNotBootstrap(authContext, 'tarrifs/put') ??
        assertRole(authContext, 'CPO', 'tarrifs/put') ??
        assertOwnership(authContext, pathCountryCode, pathPartyId, 'tarrifs/put');
      if (guardError) {return guardError;}

      // Parse and validate the incoming tariff payload
      const bodyResult = parseRequestBody<Tariff>(event.body);
      if (!bodyResult.ok) {
        console.warn(`[OCPI][tarrifs/put] Rejected — invalid or missing request body from ${authContext.partnerId}`);
        return bodyResult.error;
      }
      const tariff = bodyResult.data;

      const bodyError = assertBodyConsistency(tariff, pathCountryCode, pathPartyId, pathTariffId, 'tarrifs/put', authContext.partnerId);
      if (bodyError) {return bodyError;}

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
