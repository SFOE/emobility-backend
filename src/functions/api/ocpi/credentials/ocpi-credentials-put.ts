import { APIGatewayProxyResult } from 'aws-lambda';
import { APIGatewayProxyEventV2WithLambdaAuthorizer } from 'aws-lambda/trigger/api-gateway-proxy';
import { ErrorHandler } from '/opt/nodejs/api/error/api-error-handler';
import { OCPIAuthorizerContext } from '/opt/nodejs/api/base.model';
import {
    prepareOCPIResponse,
    withVersionCheck,
} from '/opt/nodejs/utils/api.utils';
import { extractToken } from '/opt/nodejs/utils/ocpi-utils';
import { OCPICredential } from '/opt/nodejs/db/ocpi-credentials/ocpi-credentials.model';
import { updateCredentials } from '/opt/nodejs/db/ocpi-credentials/ocpi-credentials.db';

/**
 * Handles PUT /ocpi/{version}/credentials.
 * Updates the credentials of an already registered OCPI partner.
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

            const currentToken = extractToken(authorizationHeader);

            if (!currentToken) {
                return ErrorHandler.handleBadRequestError(
                    2001,
                    'Invalid Authorization header!',
                    401,
                );
            }

            if (!event.body) {
                return ErrorHandler.handleBadRequestError(
                    2001,
                    'Missing credentials payload!',
                );
            }

            const updatedCredentials = JSON.parse(event.body) as OCPICredential;

            // Basic payload validation until a dedicated schema validation is introduced.
            if (
                !updatedCredentials.token ||
                !updatedCredentials.url ||
                !updatedCredentials.roles ||
                updatedCredentials.roles.length === 0
            ) {
                return ErrorHandler.handleBadRequestError(
                    2001,
                    'Invalid credentials payload!',
                );
            }

            const updatedCredentialItem = await updateCredentials(
                currentToken,
                updatedCredentials,
            );

            if (!updatedCredentialItem) {
                return ErrorHandler.handleBadRequestError(
                    2000,
                    'Credentials not found!',
                    404,
                );
            }

            const response: OCPICredential = {
                token: updatedCredentialItem.token,
                url: updatedCredentialItem.url,
                hub_party_id: updatedCredentialItem.hub_party_id,
                roles: updatedCredentialItem.roles,
            };

            return prepareOCPIResponse(response);
        } catch (err) {
            console.error(err);
            return ErrorHandler.handleError(err);
        }
    },
);