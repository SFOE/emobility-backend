import { APIGatewayProxyResult } from 'aws-lambda';
import { ErrorHandler } from '/opt/nodejs/api/error/api-error-handler';
import {
    prepareOCPIResponse,
    withVersionCheck,
} from '/opt/nodejs/utils/api.utils';
import { getCredentials } from '/opt/nodejs/db/ocpi-credentials/ocpi-credentials.db';
import { OCPICredential } from '/opt/nodejs/db/ocpi-credentials/ocpi-credentials.model';
import { extractToken } from '/opt/nodejs/utils/ocpi-utils';
import { APIGatewayProxyEventV2WithLambdaAuthorizer } from 'aws-lambda/trigger/api-gateway-proxy';
import { OCPIAuthorizerContext } from '/opt/nodejs/api/base.model';

/**
 * Handles GET /ocpi/{version}/credentials.
 * Returns the stored credentials for the currently authenticated token.
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

            const response: OCPICredential = {
                token: credentials.token,
                url: credentials.url,
                hub_party_id: credentials.hub_party_id,
                roles: credentials.roles,
            };

            return prepareOCPIResponse(response);
        } catch (err) {
            console.error(err);
            return ErrorHandler.handleError(err);
        }
    },
);