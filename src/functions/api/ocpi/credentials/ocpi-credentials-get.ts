import { APIGatewayProxyResult } from 'aws-lambda';
import { APIGatewayProxyEventV2WithLambdaAuthorizer } from 'aws-lambda/trigger/api-gateway-proxy';
import { ErrorHandler } from '/opt/nodejs/api/error/api-error-handler';
import { OCPIAuthorizerContext } from '/opt/nodejs/api/base.model';
import { prepareOCPIResponse } from '/opt/nodejs/utils/api.utils';
import { getRequiredBaseUrl, withVersionCheck } from '/opt/nodejs/utils/ocpi-guards';
import { OCPICredential } from '/opt/nodejs/modules/ocpi-credentials/ocpi-credentials.model';
import { getPartySecret } from '/opt/nodejs/aws/secrets-manager';
import { BFE_ROLE, BFE_HUB_PARTY_ID } from '/opt/nodejs/config.constants';

/**
 * Handles GET /ocpi/{version}/credentials.
 * Returns BFE's currently registered credentials for the authenticated party.
 */
export const handler = withVersionCheck()(async (
        _event: APIGatewayProxyEventV2WithLambdaAuthorizer<OCPIAuthorizerContext>,
        authContext: OCPIAuthorizerContext,
    ): Promise<APIGatewayProxyResult> => {
        try {
            const baseUrl = getRequiredBaseUrl();

            if (!authContext.secretRef) {
                console.warn(
                    `[OCPI][credentials/get] Rejected — missing credentials secret reference for ${authContext.partnerId}`,
                );

                return ErrorHandler.handleBadRequestError(
                    2000,
                    'Credentials secret reference not found!',
                    404,
                );
            }

            // Load TOKEN_C from Secrets Manager using the reference provided by the authorizer.
            const partySecret = await getPartySecret(authContext.secretRef);

            if (!partySecret) {
                console.warn(
                    `[OCPI][credentials/get] Rejected — credentials secret not found for ${authContext.partnerId}`,
                );

                return ErrorHandler.handleBadRequestError(
                    2000,
                    'Credentials secret not found!',
                    404,
                );
            }

            const response: OCPICredential = {
                token: partySecret.CREDENTIALS_TOKEN_C,
                url: `${baseUrl}/ocpi/versions`,
                hub_party_id: BFE_HUB_PARTY_ID,
                roles: [BFE_ROLE],
            };

            return prepareOCPIResponse(response);
        } catch (err) {
            console.error(
                `[OCPI][credentials/get] Unexpected error for party ${authContext.partnerId}:`,
                err,
            );
            return ErrorHandler.handleError(err);
        }
    });