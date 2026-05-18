import { APIGatewayProxyResult } from 'aws-lambda';
import { APIGatewayProxyEventV2WithLambdaAuthorizer } from 'aws-lambda/trigger/api-gateway-proxy';
import { ErrorHandler } from '/opt/nodejs/api/error/api-error-handler';
import { OCPIAuthorizerContext } from '/opt/nodejs/api/base.model';
import { deleteCredentials } from '/opt/nodejs/db/ocpi-credentials/ocpi-credentials.db';
import { prepareOCPIResponse, withVersionCheck } from '/opt/nodejs/utils/api.utils';
import { deletePartySecret } from '/opt/nodejs/aws/secrets-manager';

/**
 * Handles DELETE /ocpi/{version}/credentials.
 * Terminates an existing OCPI credentials connection.
 */
export const handler = withVersionCheck(
    async (
        _event: APIGatewayProxyEventV2WithLambdaAuthorizer<OCPIAuthorizerContext>,
        authContext: OCPIAuthorizerContext,
    ): Promise<APIGatewayProxyResult> => {
        try {
            if (authContext.isBootstrap) {
                return ErrorHandler.handleBadRequestError(
                    2000,
                    'Bootstrap token cannot be used to delete credentials!',
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

            // Delete the stored OCPI token pair from Secrets Manager.
            await deletePartySecret(authContext.secretRef);

            // Delete the DynamoDB token mapping so TOKEN_C can no longer be used.
            await deleteCredentials(authContext.credentialPk);

            return prepareOCPIResponse(undefined);
        } catch (err) {
            console.error(
                `[OCPI][credentials/delete] Unexpected error for party ${authContext.partnerId}:`,
                err,
            );
            return ErrorHandler.handleError(err);
        }
    },
);