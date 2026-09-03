import { APIGatewayProxyResult } from 'aws-lambda';
import { APIGatewayProxyEventV2WithLambdaAuthorizer } from 'aws-lambda/trigger/api-gateway-proxy';
import { OCPIAuthorizerContext } from '/opt/nodejs/api/base.model';
import { ErrorHandler } from '/opt/nodejs/api/error/api-error-handler';
import { prepareOCPIResponse } from '/opt/nodejs/utils/api.utils';
import {
  assertNotBootstrap,
  assertRole,
  withVersionCheck,
} from '/opt/nodejs/utils/ocpi-guards';
import { publishIngestionEvent } from '/opt/nodejs/aws/sqs';

export const handler = withVersionCheck(
  (_event, auth) =>
    assertNotBootstrap(auth, 'tariffs/delete') ??
    assertRole(auth, 'tariffs/delete'),
)(async (
  event: APIGatewayProxyEventV2WithLambdaAuthorizer<OCPIAuthorizerContext>,
  authContext: OCPIAuthorizerContext,
  ocpiVersion: string,
): Promise<APIGatewayProxyResult> => {
  try {
    const pathCountryCode = event.pathParameters?.country_code;
    const pathPartyId = event.pathParameters?.party_id;
    const pathTariffId = event.pathParameters?.tariff_id;

    const receivedAt = new Date().toISOString();

    // DELETE does not write to S3; only an SQS event is published so the Loader can apply a soft-delete in the Bronze layer
    try {
      await publishIngestionEvent({
        action: 'DELETE',
        type: 'tariffs',
        tariff_id: pathTariffId!,
        country_code: pathCountryCode!,
        party_id: pathPartyId!,
        ocpi_version: ocpiVersion,
        received_at: receivedAt,
        raw: null,
      });
      console.info(
        `[OCPI][tariffs/delete] Delete event published for tariff ${pathCountryCode}/${pathPartyId}/${pathTariffId} from ${authContext.partnerId}`,
      );
    } catch (err) {
      console.error(
        `[OCPI][tariffs/delete] SQS publish failed for ${pathCountryCode}/${pathPartyId}/${pathTariffId} from ${authContext.partnerId}:`,
        err,
      );
      return ErrorHandler.handleError(err);
    }

    // DELETE returns no data per OCPI spec
    return prepareOCPIResponse(null);
  } catch (err) {
    console.error(
      `[OCPI][tariffs/delete] Unexpected error for party ${authContext.partnerId}:`,
      err,
    );
    return ErrorHandler.handleError(err);
  }
});
