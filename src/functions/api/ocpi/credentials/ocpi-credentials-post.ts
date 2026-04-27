import { APIGatewayProxyResult } from 'aws-lambda';
import { APIGatewayProxyEventV2WithLambdaAuthorizer } from 'aws-lambda/trigger/api-gateway-proxy';
import { ErrorHandler } from '/opt/nodejs/api/error/api-error-handler';
import { OCPIAuthorizerContext } from '/opt/nodejs/api/base.model';
import { prepareOCPIResponse, withVersionCheck } from '/opt/nodejs/utils/api.utils';
import { OCPICredential } from '/opt/nodejs/db/ocpi-credentials/ocpi-credentials.model';
import { invalidateBootstrapToken, saveNewCredentials } from '/opt/nodejs/db/ocpi-credentials/ocpi-credentials.db';
import { BFE_ROLE } from '/opt/nodejs/config.constants';
import { generateToken } from '/opt/nodejs/utils/crypto.utils';
import { partySecretExists, savePartySecret } from '/opt/nodejs/utils/secrets.utils';
import { extractToken, validateCredentialsPayload } from '/opt/nodejs/utils/ocpi-utils';

export const handler = withVersionCheck(
  async (
    event: APIGatewayProxyEventV2WithLambdaAuthorizer<OCPIAuthorizerContext>,
    authContext: OCPIAuthorizerContext,
  ): Promise<APIGatewayProxyResult> => {
    try {
      // Fail fast on missing config before any business logic or async work
      if (!process.env.BASE_URL) {
        throw new Error('BASE_URL environment variable is not set');
      }

      // Only bootstrap tokens are permitted for the initial registration handshake
      if (!authContext.isBootstrap) {
        console.warn(`[OCPI][credentials/post] Rejected — ${authContext.partnerId} is already registered`);
        return ErrorHandler.handleBadRequestError(2000, 'Only bootstrap tokens are allowed, client already has a token!', 405);
      }

      // Reject requests without a body before attempting to parse
      if (!event.body) {
        console.warn(`[OCPI][credentials/post] Rejected — missing request body from ${authContext.partnerId}`);
        return ErrorHandler.handleBadRequestError(2001, 'Request body is missing!');
      }

      // Parse the incoming credentials payload
      let credentials: OCPICredential;
      try {
        credentials = JSON.parse(event.body);
      } catch {
        console.warn(`[OCPI][credentials/post] Rejected — invalid JSON body from ${authContext.partnerId}`);
        return ErrorHandler.handleBadRequestError(2001, 'Invalid request body: expected JSON!');
      }

      // Prefer the CPO role as primary identifier; fall back to first entry for non-CPO parties
      const primaryRole = credentials.roles?.find((r) => r.role === 'CPO') ?? credentials.roles?.[0];
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
      const tokenBSecretRef = await savePartySecret(primaryRole, credentials.token, newToken);
      await saveNewCredentials(credentials, newToken, tokenBSecretRef);

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
        url: `${process.env.BASE_URL}/ocpi/versions`,
        roles: [BFE_ROLE],
      } satisfies OCPICredential);
    } catch (err) {
      console.error(`[OCPI][credentials/post] Unexpected error for party ${authContext.partnerId}:`, err);
      return ErrorHandler.handleError(err);
    }
  },
);
