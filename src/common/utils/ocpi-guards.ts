import { APIGatewayProxyResult } from 'aws-lambda';
import { APIGatewayProxyEventV2WithLambdaAuthorizer } from 'aws-lambda/trigger/api-gateway-proxy';
import { OCPIAuthorizerContext } from '/opt/nodejs/api/base.model';
import { ErrorHandler } from '/opt/nodejs/api/error/api-error-handler';
import { SUPPORTED_VERSIONS } from '/opt/nodejs/config.constants';
import {
  OCPICredential,
  OCPICredentialRole,
  OCPIRole,
  OCPI_ROLES,
} from '/opt/nodejs/modules/ocpi-credentials/ocpi-credentials.model';

// Types
export type OCPIHandler = (
  event: APIGatewayProxyEventV2WithLambdaAuthorizer<OCPIAuthorizerContext>,
  authContext: OCPIAuthorizerContext,
  ocpiVersion: string,
) => Promise<APIGatewayProxyResult>;

export type GuardFn = (
  event: APIGatewayProxyEventV2WithLambdaAuthorizer<OCPIAuthorizerContext>,
  authContext: OCPIAuthorizerContext,
) => APIGatewayProxyResult | null;

// Validates the OCPI version, extracts the authorizer context, runs the optional guard, then calls the handler.
export const withVersionCheck =
  (guard?: GuardFn) =>
  (handler: OCPIHandler) =>
  async (
    event: APIGatewayProxyEventV2WithLambdaAuthorizer<OCPIAuthorizerContext>,
  ): Promise<APIGatewayProxyResult> => {
    const authContext = event.requestContext?.authorizer?.lambda || {};
    const version = event.pathParameters?.version ?? 'unknown';

    if (!SUPPORTED_VERSIONS.includes(version)) {
      return ErrorHandler.handleUnsupportedVersionError(version);
    }

    const guardError = guard?.(event, authContext) ?? null;
    if (guardError) {
      return guardError;
    }

    return handler(event, authContext, version);
  };

// Discriminated union result type for parseRequestBody.
type ParseBodyResult<T> =
  { success: true; data: T } | { success: false; error: APIGatewayProxyResult };

// Parses and validates the JSON request body. Returns success:false with a 400 response if missing or malformed.
export function parseRequestBody<T>(
  body: string | undefined,
): ParseBodyResult<T> {
  if (!body) {
    return {
      success: false,
      error: ErrorHandler.handleBadRequestError(
        2001,
        'Request body is missing!',
      ),
    };
  }
  try {
    return { success: true, data: JSON.parse(body) as T };
  } catch {
    return {
      success: false,
      error: ErrorHandler.handleBadRequestError(
        2001,
        'Invalid request body: expected JSON!',
      ),
    };
  }
}

// Validates the OCPI credentials payload against the spec (token, roles, party_id, country_code, business_details).
export function validateCredentialsPayload(
  credentials: OCPICredential,
  primaryRole: OCPICredentialRole | undefined,
): string | null {
  if (!credentials.token) {
    return 'Invalid credentials payload!';
  }
  if (
    !Array.isArray(credentials.roles) ||
    credentials.roles.length === 0 ||
    !primaryRole
  ) {
    return 'Invalid credentials payload: roles must be a non-empty array!';
  }
  if (!primaryRole.role) {
    return 'Invalid credentials payload: role is required!';
  }
  if (!primaryRole.party_id || !/^[\x21-\x7E]{3}$/.test(primaryRole.party_id)) {
    return 'Invalid credentials payload: party_id must be 3 printable ASCII characters (CiString(3))!';
  }
  if (
    !primaryRole.country_code ||
    !/^[\x21-\x7E]{2}$/.test(primaryRole.country_code)
  ) {
    return 'Invalid credentials payload: country_code must be 2 printable ASCII characters (CiString(2))!';
  }
  if (!primaryRole.business_details?.name) {
    return 'Invalid credentials payload: business_details.name is required!';
  }
  return null;
}

// Returns BASE_URL from env or throws if not set. Use in handlers that build versioned response URLs.
export const getRequiredBaseUrl = (): string => {
  if (!process.env.BASE_URL) {
    throw new Error('BASE_URL environment variable is not set');
  }
  return process.env.BASE_URL;
};

// Requires a bootstrap token. Rejects already-registered parties. Used in credentials POST (initial registration).
export function assertIsBootstrap(
  authContext: OCPIAuthorizerContext,
  label: string,
): APIGatewayProxyResult | null {
  if (authContext.isBootstrap) {
    return null;
  }
  console.warn(
    `[OCPI][${label}] Rejected — ${authContext.partnerId} is already registered`,
  );
  return ErrorHandler.handleBadRequestError(
    2000,
    'Only bootstrap tokens are allowed, client already has a token!',
    405,
  );
}

// Requires secretRef and credentialPk on the auth token. Used in credentials PUT/DELETE after assertNotBootstrap.
export function assertContextComplete(
  authContext: OCPIAuthorizerContext,
  label: string,
): APIGatewayProxyResult | null {
  if (authContext.secretRef && authContext.credentialPk) {
    return null;
  }
  console.warn(
    `[OCPI][${label}] Rejected — incomplete credential context for ${authContext.partnerId}`,
  );
  return ErrorHandler.handleBadRequestError(
    2000,
    'Credential context is incomplete!',
    403,
  );
}

// Rejects bootstrap tokens. Per OCPI spec, all operations except credentials POST require a registered party (405).
export function assertNotBootstrap(
  authContext: OCPIAuthorizerContext,
  label: string,
): APIGatewayProxyResult | null {
  if (!authContext.isBootstrap) {
    return null;
  }
  console.warn(
    `[OCPI][${label}] Rejected — bootstrap token used by ${authContext.partnerId}`,
  );
  return ErrorHandler.handleBadRequestError(
    2000,
    'Bootstrap tokens are not allowed for this operation.',
    405,
  );
}

// Enforces that the authenticated party has a valid OCPI role.
export function assertRole(
  authContext: OCPIAuthorizerContext,
  label: string,
): APIGatewayProxyResult | null {
  if (OCPI_ROLES.includes(authContext.role as OCPIRole)) {
    return null;
  }
  console.warn(
    `[OCPI][${label}] Rejected — invalid OCPI role '${authContext.role}' (party: ${authContext.partnerId})`,
  );
  return ErrorHandler.handleBadRequestError(
    2000,
    `Role '${authContext.role}' is not a valid OCPI role.`,
    405,
  );
}

// Validates that the patch body contains a valid ISO 8601 last_updated field. Called inline after body parsing in all PATCH handlers.
export function assertValidPatchLastUpdated(
  patch: Record<string, unknown>,
  partnerId: string,
  label: string,
): APIGatewayProxyResult | null {
  if (
    typeof patch['last_updated'] !== 'string' ||
    patch['last_updated'].length === 0 ||
    isNaN(Date.parse(patch['last_updated']))
  ) {
    console.warn(
      `[OCPI][${label}] Rejected — missing or invalid last_updated from ${partnerId}`,
    );
    return ErrorHandler.handleBadRequestError(
      2001,
      'Partial updates must include a valid ISO 8601 last_updated field.',
    );
  }
  return null;
}

// Enforces that path identifiers match the body identifiers (country_code, party_id, id). Called inline after body parsing.
export function assertBodyConsistency(
  body: { country_code: string; party_id: string; id: string },
  pathCountryCode: string | undefined,
  pathPartyId: string | undefined,
  pathId: string | undefined,
  label: string,
  partnerId: string,
): APIGatewayProxyResult | null {
  if (
    body.country_code === pathCountryCode &&
    body.party_id === pathPartyId &&
    body.id === pathId
  ) {
    return null;
  }
  const partyRef = `${pathCountryCode}/${pathPartyId}/${pathId}`;
  console.warn(
    `[OCPI][${label}] Rejected — body mismatch for ${partnerId}: path=${partyRef}, body=${body.country_code}/${body.party_id}/${body.id}`,
  );
  return ErrorHandler.handleBadRequestError(
    2001,
    'Identifiers in path and body do not match.',
  );
}
