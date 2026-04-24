import { APIGatewayProxyResult } from 'aws-lambda';
import { ErrorHandler } from '/opt/nodejs/api/error/api-error-handler';
import {
  prepareOCPIResponse,
  withVersionCheck,
} from '/opt/nodejs/utils/api.utils';
import { OCPICredential } from '/opt/nodejs/db/ocpi-credentials/ocpi-credentials.model';
import { invalidateBootstrapToken, saveNewCredentials } from '/opt/nodejs/db/ocpi-credentials/ocpi-credentials.db';
import { generateToken } from '/opt/nodejs/utils/crypto.utils';
import { BFE_ROLE } from '/opt/nodejs/config.constants';
import { partySecretExists, savePartySecret } from '/opt/nodejs/utils/secrets.utils';
import { extractToken } from '/opt/nodejs/utils/ocpi-utils';
import { APIGatewayProxyEventV2WithLambdaAuthorizer } from 'aws-lambda/trigger/api-gateway-proxy';
import { OCPIAuthorizerContext } from '/opt/nodejs/api/base.model';

export const handler = withVersionCheck(
  async (
    event: APIGatewayProxyEventV2WithLambdaAuthorizer<OCPIAuthorizerContext>,
    authContext: OCPIAuthorizerContext,
  ): Promise<APIGatewayProxyResult> => {
    try {
      if (!authContext.isBootstrap) {
        return ErrorHandler.handleBadRequestError(
          2000,
          'Only bootstrap tokens are allowed, client already has a token!',
          405,
        );
      }

      const cpoCredentials: OCPICredential = JSON.parse(event.body ?? '{}');

      // Basic validation
      if (!cpoCredentials.token) {
        return ErrorHandler.handleBadRequestError(
          2001,
          'Invalid credentials payload!',
        );
      }

      if (await partySecretExists(cpoCredentials.roles[0])) {
        return ErrorHandler.handleBadRequestError(
          2001,
          'CPO is already registered.',
          405,
        );
      }

      const newToken = generateToken();

      // save tokens in Secrets Manager, use secret reference for DynamoDB
      const tokenBSecretRef = await savePartySecret(cpoCredentials.roles[0], cpoCredentials.token, newToken);

      // save credentials with secret reference instead of plaintext token
      await saveNewCredentials(cpoCredentials, newToken, tokenBSecretRef);

      // invalidate the bootstrap token so it cannot be reused
      const authHeader = event.headers?.authorization || event.headers?.Authorization;
      const bootstrapToken = extractToken(authHeader)!;
      await invalidateBootstrapToken(bootstrapToken);

      const response: OCPICredential = {
        token: newToken,
        url: `${process.env.BASE_URL}/ocpi/versions`,
        roles: [BFE_ROLE],
      };

      return prepareOCPIResponse(response);
    } catch (err) {
      console.error(err);
      return ErrorHandler.handleError(err);
    }
  },
);
