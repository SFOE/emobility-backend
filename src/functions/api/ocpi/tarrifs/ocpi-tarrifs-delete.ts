import { APIGatewayProxyResult } from 'aws-lambda';
import { APIGatewayProxyEventV2WithLambdaAuthorizer } from 'aws-lambda/trigger/api-gateway-proxy';
import { ErrorHandler } from '/opt/nodejs/api/error/api-error-handler';
import { OCPIAuthorizerContext } from '/opt/nodejs/api/base.model';
import { prepareOCPIResponse, withVersionCheck } from '/opt/nodejs/utils/api.utils';

export const handler = withVersionCheck(
  async (
    event: APIGatewayProxyEventV2WithLambdaAuthorizer<OCPIAuthorizerContext>,
    authContext: OCPIAuthorizerContext,
  ): Promise<APIGatewayProxyResult> => {
    try {
      // Only registered parties may delete tariffs — bootstrap tokens are not permitted here
      if (authContext.isBootstrap) {
        console.warn(`[OCPI][tarrifs/delete] Rejected — bootstrap token used by ${authContext.partnerId}`);
        return ErrorHandler.handleBadRequestError(2000, 'Bootstrap tokens are not allowed for tariff operations.', 405);
      }

      // Only CPOs are the data owner of tariffs per OCPI spec
      if (authContext.role !== 'CPO') {
        console.warn(`[OCPI][tarrifs/delete] Rejected — non-CPO role '${authContext.role}' used by ${authContext.partnerId}`);
        return ErrorHandler.handleBadRequestError(2000, 'Only CPOs are allowed to delete tariffs.', 405);
      }

      const pathCountryCode = event.pathParameters?.country_code;
      const pathPartyId = event.pathParameters?.party_id;
      const pathTariffId = event.pathParameters?.tariff_id;

      // Enforce Client Owned Objects: authenticated party must own the namespace in the path
      if (authContext.country_code !== pathCountryCode || authContext.party_id !== pathPartyId) {
        console.warn(`[OCPI][tarrifs/delete] Rejected — ownership mismatch for ${authContext.partnerId}: auth=${authContext.country_code}/${authContext.party_id}, path=${pathCountryCode}/${pathPartyId}`);
        return ErrorHandler.handleBadRequestError(2001, 'Authenticated party does not own this tariff namespace.');
      }

      // Data Lakehouse connection not yet available — deletion acknowledged
      console.info(`[OCPI][tarrifs/delete] Received delete for tariff ${pathCountryCode}/${pathPartyId}/${pathTariffId} from ${authContext.partnerId}`);

      // DELETE returns no data per OCPI spec
      return prepareOCPIResponse(null);
    } catch (err) {
      console.error(`[OCPI][tarrifs/delete] Unexpected error for party ${authContext.partnerId}:`, err);
      return ErrorHandler.handleError(err);
    }
  },
);
