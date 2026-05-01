import { APIGatewayProxyResult } from 'aws-lambda';
import { APIGatewayProxyEventV2WithLambdaAuthorizer } from 'aws-lambda/trigger/api-gateway-proxy';
import { ErrorHandler } from '/opt/nodejs/api/error/api-error-handler';
import { OCPIAuthorizerContext } from '/opt/nodejs/api/base.model';
import { OCPICredential } from '/opt/nodejs/db/ocpi-credentials/ocpi-credentials.model';
import { rotateCredentialsToken } from '/opt/nodejs/db/ocpi-credentials/ocpi-credentials.db';
import { BFE_HUB_PARTY_ID, BFE_ROLE } from '/opt/nodejs/config.constants';
import {
    prepareOCPIResponse,
    withVersionCheck,
} from '/opt/nodejs/utils/api.utils';
import {
    validateCredentialsPayload,
} from '/opt/nodejs/utils/ocpi-utils';
import { generateToken } from '/opt/nodejs/utils/crypto.utils';
import { updatePartySecret } from '/opt/nodejs/utils/secrets.utils';

/**
 * Handles PUT /ocpi/{version}/credentials.
 * Updates credentials for an already registered OCPI party and rotates TOKEN_C.
 */
export const handler = withVersionCheck(
    async (
        event: APIGatewayProxyEventV2WithLambdaAuthorizer<OCPIAuthorizerContext>,
        authContext: OCPIAuthorizerContext,
    ): Promise<APIGatewayProxyResult> => {
        try {
            if (!process.env.BASE_URL) {
                throw new Error('BASE_URL environment variable is not set');
            }

            if (authContext.isBootstrap) {
                return ErrorHandler.handleBadRequestError(
                    2000,
                    'Bootstrap token cannot be used to update credentials!',
                    403,
                );
            }

            if (!authContext.secretRef || !authContext.credentialPk) {
                return ErrorHandler.handleBadRequestError(
                    2000,
                    'Credential context is incomplete!',
                    403,
                );
            }

            if (!event.body) {
                return ErrorHandler.handleBadRequestError(
                    2001,
                    'Missing credentials payload!',
                );
            }

            const updatedCredentials = JSON.parse(event.body) as OCPICredential;
            const primaryRole =
                updatedCredentials.roles?.find((role) => role.role === 'CPO') ??
                updatedCredentials.roles?.[0];

            const validationError = validateCredentialsPayload(
                updatedCredentials,
                primaryRole,
            );

            if (validationError) {
                return ErrorHandler.handleBadRequestError(2001, validationError);
            }

            // Generate a new TOKEN_C for future requests from the remote party to BFE.
            const newTokenC = generateToken();

            // Update TOKEN_B and TOKEN_C in Secrets Manager for the existing party.
            await updatePartySecret(
                authContext.secretRef,
                updatedCredentials.token,
                newTokenC,
            );

            // Rotate the DynamoDB lookup key from old TOKEN_C to new TOKEN_C.
            await rotateCredentialsToken(
                authContext.credentialPk,
                updatedCredentials,
                newTokenC,
                authContext.secretRef,
            );

            const response: OCPICredential = {
                token: newTokenC,
                url: `${process.env.BASE_URL}/ocpi/versions`,
                hub_party_id: BFE_HUB_PARTY_ID,
                roles: [BFE_ROLE],
            };

            return prepareOCPIResponse(response);
        } catch (err) {
            console.error(
                `[OCPI][credentials/put] Unexpected error for party ${authContext.partnerId}:`,
                err,
            );
            return ErrorHandler.handleError(err);
        }
    },
);