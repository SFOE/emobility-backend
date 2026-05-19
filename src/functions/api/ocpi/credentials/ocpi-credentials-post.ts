import { APIGatewayProxyResult } from 'aws-lambda';
import { APIGatewayProxyEventV2WithLambdaAuthorizer } from 'aws-lambda/trigger/api-gateway-proxy';
import { ErrorHandler } from '/opt/nodejs/api/error/api-error-handler';
import { OCPIAuthorizerContext } from '/opt/nodejs/api/base.model';
import { prepareOCPIResponse } from '/opt/nodejs/utils/api.utils';
import {
  assertIsBootstrap,
  getRequiredBaseUrl,
  parseRequestBody,
  withVersionCheck,
} from '/opt/nodejs/utils/ocpi-guards';
import { OCPICredential } from '/opt/nodejs/modules/ocpi-credentials/ocpi-credentials.model';
import { invalidateBootstrapToken, saveNewCredentials } from '/opt/nodejs/modules/ocpi-credentials/ocpi-credentials.db';
import { BFE_ROLE } from '/opt/nodejs/config.constants';
import { generateToken } from '/opt/nodejs/utils/crypto.utils';
import { partySecretExists, savePartySecret } from '/opt/nodejs/aws/secrets-manager';
import { extractToken, validateCredentialsPayload, getPrimaryRole } from '/opt/nodejs/utils/ocpi-utils';

export const handler = withVersionCheck(
  (_, auth) => assertIsBootstrap(auth, 'credentials/post'),
)(async (
    event: APIGatewayProxyEventV2WithLambdaAuthorizer<OCPIAuthorizerContext>,
    authContext: OCPIAuthorizerContext,
  ): Promise<APIGatewayProxyResult> => {
    try {
      const baseUrl = getRequiredBaseUrl();

      // Parse and validate the incoming credentials payload
      const bodyResult = parseRequestBody<OCPICredential>(event.body);
      if (!bodyResult.success) {
        console.warn(`[OCPI][credentials/post] Rejected — invalid or missing request body from ${authContext.partnerId}`);
        return bodyResult.error;
      }
      const credentials = bodyResult.data;

      // Prefer the CPO role as primary identifier; fall back to first entry for non-CPO parties
      const primaryRole = getPrimaryRole(credentials.roles);
      const partyRef = `${primaryRole?.role}/${primaryRole?.country_code}/${primaryRole?.party_id}`;

      // Validate token and primary role fields according to the OCPI credentials spec
      const validationError = validateCredentialsPayload(credentials, primaryRole);
      if (validationError) {
        console.warn(`[OCPI][credentials/post] Validation failed for ${authContext.partnerId}:`, validationError);
        return ErrorHandler.handleBadRequestError(2001, validationError);
      }

      // Prevent duplicate registrations for the same party
      if (await partySecretExists(primaryRole)) {
        console.warn(`[OCPI][credentials/post] Rejected — already registered: ${partyRef}`);
        return ErrorHandler.handleBadRequestError(2001, `${partyRef} is already registered.`, 405);
      }

      // Generate TOKEN_C and persist both tokens; DynamoDB holds only the Secrets Manager reference
      const newToken = generateToken();
      const secretRef = await savePartySecret(primaryRole, credentials.token, newToken);
      await saveNewCredentials(credentials, newToken, secretRef);

      // Bootstrap token is single-use; invalidate it now that registration succeeded
      const bootstrapToken = extractToken(event.headers?.authorization || event.headers?.Authorization);
      if (!bootstrapToken) {
        throw new Error('Bootstrap token could not be extracted from authorization header');
      }
      await invalidateBootstrapToken(bootstrapToken);

      console.info(`[OCPI][credentials/post] Registration successful: ${partyRef}`);

      // Return BFE's own credentials (TOKEN_C + versions URL + role) to the registering party
      return prepareOCPIResponse({
        token: newToken,
        url: `${baseUrl}/ocpi/versions`,
        roles: [BFE_ROLE],
      } satisfies OCPICredential);
    } catch (err) {
      console.error(`[OCPI][credentials/post] Unexpected error for party ${authContext.partnerId}:`, err);
      return ErrorHandler.handleError(err);
    }
  });