import { APIGatewayProxyResult } from 'aws-lambda';
import { APIGatewayProxyEventV2WithLambdaAuthorizer } from 'aws-lambda/trigger/api-gateway-proxy';
import { OCPIAuthorizerContext } from '/opt/nodejs/api/base.model';
import { ErrorHandler } from '/opt/nodejs/api/error/api-error-handler';
import { prepareOCPIResponse, withVersionCheck } from '/opt/nodejs/utils/api.utils';
import { assertNotBootstrap, assertOwnership, assertRole } from '/opt/nodejs/utils/ocpi-guards';

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
        assertNotBootstrap(authContext, 'tarrifs/delete') ??
        assertRole(authContext, 'CPO', 'tarrifs/delete') ??
        assertOwnership(authContext, pathCountryCode, pathPartyId, 'tarrifs/delete');
      if (guardError) {return guardError;}

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
