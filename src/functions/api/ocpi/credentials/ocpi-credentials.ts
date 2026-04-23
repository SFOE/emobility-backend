import { APIGatewayProxyResult } from 'aws-lambda';
import { ErrorHandler } from '/opt/nodejs/api/error/api-error-handler';
import {
  prepareOCPIResponse,
  withVersionCheck,
} from '/opt/nodejs/utils/api.utils';
import { OCPICredential } from '/opt/nodejs/db/ocpi-credentials/ocpi-credentials.model';
import { saveNewCredentials } from '/opt/nodejs/db/ocpi-credentials/ocpi-credentials.db';
import { generateToken } from '/opt/nodejs/utils/crypto.utils';
import { BFE_ROLE } from '/opt/nodejs/config.constants';
import { savePartySecret } from '/opt/nodejs/utils/secrets.utils';
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

      const newToken = generateToken();

      // save credentials
      await saveNewCredentials(cpoCredentials, newToken);

      // save tokens in Secrets Manager
      await savePartySecret(cpoCredentials.roles[0], cpoCredentials.token, newToken);

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
