import { APIGatewayProxyResult } from 'aws-lambda';
import { APIGatewayProxyEventV2WithLambdaAuthorizer } from 'aws-lambda/trigger/api-gateway-proxy';
import { ErrorHandler } from '/opt/nodejs/api/error/api-error-handler';
import { OCPIAuthorizerContext } from '/opt/nodejs/api/base.model';
import {
    prepareOCPIResponse,
    withVersionCheck,
} from '/opt/nodejs/utils/api.utils';
import { getCredentials } from '/opt/nodejs/db/ocpi-credentials/ocpi-credentials.db';
import { OCPICredential } from '/opt/nodejs/db/ocpi-credentials/ocpi-credentials.model';
import { extractToken } from '/opt/nodejs/utils/ocpi-utils';
import { getPartySecret } from '/opt/nodejs/utils/secrets.utils';
import { BFE_ROLE } from '/opt/nodejs/config.constants';

/**
 * Handles GET /ocpi/{version}/credentials.
 * Returns BFE's currently registered credentials for the authenticated party.
 */
export const handler = withVersionCheck(
    async (
        event: APIGatewayProxyEventV2WithLambdaAuthorizer<OCPIAuthorizerContext>,
    ): Promise<APIGatewayProxyResult> => {
        try {

            const authorizationHeader =
                event.headers.authorization ?? event.headers.Authorization;

            if (!authorizationHeader) {
                return ErrorHandler.handleBadRequestError(
                    2001,
                    'Missing Authorization header!',
                    401,
                );
            }

            const token = extractToken(authorizationHeader);

            if (!token) {
                return ErrorHandler.handleBadRequestError(
                    2001,
                    'Invalid Authorization header!',
                    401,
                );
            }

            const credentials = await getCredentials(token);

            if (!credentials) {
                return ErrorHandler.handleBadRequestError(
                    2000,
                    'Credentials not found!',
                    404,
                );
            }

            // DynamoDB stores the Secrets Manager reference instead of the plaintext token.
            const partySecret = await getPartySecret(credentials.token);

            if (!partySecret) {
                return ErrorHandler.handleBadRequestError(
                    2000,
                    'Credentials secret not found!',
                    404,
                );
            }

            const response: OCPICredential = {
                token: partySecret.CREDENTIALS_TOKEN_C,
                url: credentials.url,
                hub_party_id: credentials.hub_party_id,
                roles: [BFE_ROLE],
            };

            return prepareOCPIResponse(response);
        } catch (err) {
            console.error('[OCPI][credentials/get] Unexpected error:', err);
            return ErrorHandler.handleError(err);
        }
    },
);