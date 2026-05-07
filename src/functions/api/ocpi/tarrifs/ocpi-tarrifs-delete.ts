import { APIGatewayProxyResult } from 'aws-lambda';
import { APIGatewayProxyEventV2WithLambdaAuthorizer } from 'aws-lambda/trigger/api-gateway-proxy';
import { OCPIAuthorizerContext } from '/opt/nodejs/api/base.model';
import { ErrorHandler } from '/opt/nodejs/api/error/api-error-handler';
import {
  prepareOCPIResponse,
  withVersionCheck,
} from '/opt/nodejs/utils/api.utils';
import {
  assertNotBootstrap,
  assertOwnership,
  assertRole,
} from '/opt/nodejs/utils/ocpi-guards';
import { publishIngestionEvent } from '/opt/nodejs/utils/ingestion.utils';

export const handler = withVersionCheck(
  async (
    event: APIGatewayProxyEventV2WithLambdaAuthorizer<OCPIAuthorizerContext>,
    authContext: OCPIAuthorizerContext,
    ocpiVersion: string,
  ): Promise<APIGatewayProxyResult> => {
    try {
      // Identifiers from the request URL path — e.g. DELETE /tariffs/{country_code}/{party_id}/{tariff_id}
      const pathCountryCode = event.pathParameters?.country_code;
      const pathPartyId = event.pathParameters?.party_id;
      const pathTariffId = event.pathParameters?.tariff_id;

      // Only registered CPOs may delete tariffs in their own namespace; bootstrap tokens and other roles are rejected
      const guardError =
        assertNotBootstrap(authContext, 'tarrifs/delete') ??
        assertRole(authContext, 'CPO', 'tarrifs/delete') ??
        assertOwnership(
          authContext,
          pathCountryCode,
          pathPartyId,
          'tarrifs/delete',
        );
      if (guardError) {
        return guardError;
      }

      const receivedAt = new Date().toISOString();

      // DELETE does not write to S3; only an SQS event is published so the Loader can apply a soft-delete in the Bronze layer
      try {
        await publishIngestionEvent({
          action: 'DELETE',
          type: 'tariffs',
          object_id: pathTariffId!,
          country_code: pathCountryCode!,
          party_id: pathPartyId!,
          ocpi_version: ocpiVersion,
          received_at: receivedAt,
          raw: null,
        });
        console.info(
          `[OCPI][tarrifs/delete] Delete event published for tariff ${pathCountryCode}/${pathPartyId}/${pathTariffId} from ${authContext.partnerId}`,
        );
      } catch (err) {
        console.error(
          `[OCPI][tarrifs/delete] SQS publish failed for ${pathCountryCode}/${pathPartyId}/${pathTariffId} from ${authContext.partnerId}:`,
          err,
        );
        return ErrorHandler.handleError(err);
      }

      // DELETE returns no data per OCPI spec
      return prepareOCPIResponse(null);
    } catch (err) {
      console.error(
        `[OCPI][tarrifs/delete] Unexpected error for party ${authContext.partnerId}:`,
        err,
      );
      return ErrorHandler.handleError(err);
    }
  },
);
