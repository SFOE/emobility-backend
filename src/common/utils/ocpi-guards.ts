import { APIGatewayProxyResult } from 'aws-lambda';
import { APIGatewayProxyEventV2WithLambdaAuthorizer } from 'aws-lambda/trigger/api-gateway-proxy';
import { OCPIAuthorizerContext } from '/opt/nodejs/api/base.model';
import { ErrorHandler } from '/opt/nodejs/api/error/api-error-handler';
import { SUPPORTED_VERSIONS } from '/opt/nodejs/config.constants';
import {
  OCPICredential,
  OCPICredentialRole,
} from '/opt/nodejs/db/ocpi-credentials/ocpi-credentials.model';

// --- Types ---

export type OCPIHandler = (
  event: APIGatewayProxyEventV2WithLambdaAuthorizer<OCPIAuthorizerContext>,
  authContext: OCPIAuthorizerContext,
  ocpiVersion: string,
) => Promise<APIGatewayProxyResult>;

/** A guard runs before the handler. Return a result to short-circuit, or null to continue. */
export type Guard = (...args: Parameters<OCPIHandler>) => APIGatewayProxyResult | null;

// --- Body validation ---

type ParseBodyResult<T> = { ok: true; data: T } | { ok: false; error: APIGatewayProxyResult };

export function parseRequestBody<T>(body: string | undefined): ParseBodyResult<T> {
  if (!body) {
    return { ok: false, error: ErrorHandler.handleBadRequestError(2001, 'Request body is missing!') };
  }
  try {
    return { ok: true, data: JSON.parse(body) as T };
  } catch {
    return { ok: false, error: ErrorHandler.handleBadRequestError(2001, 'Invalid request body: expected JSON!') };
  }
}

// --- Environment assertions ---

export const getRequiredBaseUrl = (): string => {
  if (!process.env.BASE_URL) {
    throw new Error('BASE_URL environment variable is not set');
  }
  return process.env.BASE_URL;
};

// --- Middleware ---

/** Composes a list of guards in front of a handler. Guards run left-to-right; first failure short-circuits. */
export const withGuards =
  (guards: Guard[]) =>
  (handler: OCPIHandler): OCPIHandler =>
  async (event, authContext, version) => {
    for (const guard of guards) {
      const error = guard(event, authContext, version);
      if (error) return error;
    }
    return handler(event, authContext, version);
  };

/** Validates the OCPI version in the path and extracts the authorizer context before calling the handler. */
export const withVersionCheck =
  (handler: OCPIHandler) =>
  async (
    event: APIGatewayProxyEventV2WithLambdaAuthorizer<OCPIAuthorizerContext>,
  ): Promise<APIGatewayProxyResult> => {
    const authContext = event.requestContext?.authorizer?.lambda || {};
    const version = event.pathParameters?.version ?? 'unknown';

    if (!SUPPORTED_VERSIONS.includes(version)) {
      return ErrorHandler.handleUnsupportedVersionError(version);
    }

    return handler(event, authContext, version);
  };

// --- Credential validation ---

export function validateCredentialsPayload(
  credentials: OCPICredential,
  primaryRole: OCPICredentialRole | undefined,
): string | null {
  if (!credentials.token) {
    return 'Invalid credentials payload!';
  }

  if (!Array.isArray(credentials.roles) || credentials.roles.length === 0 || !primaryRole) {
    return 'Invalid credentials payload: roles must be a non-empty array!';
  }

  if (!primaryRole.role) {
    return 'Invalid credentials payload: role is required!';
  }

  if (!primaryRole.party_id || !/^[\x21-\x7E]{3}$/.test(primaryRole.party_id)) {
    return 'Invalid credentials payload: party_id must be 3 printable ASCII characters (CiString(3))!';
  }

  if (!primaryRole.country_code || !/^[\x21-\x7E]{2}$/.test(primaryRole.country_code)) {
    return 'Invalid credentials payload: country_code must be 2 printable ASCII characters (CiString(2))!';
  }

  if (!primaryRole.business_details?.name) {
    return 'Invalid credentials payload: business_details.name is required!';
  }

  return null;
}

// --- Authorization guards ---

/** Rejects bootstrap tokens for endpoints that require a fully registered party. */
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

/** Enforces that the authenticated party has the required OCPI role. */
export function assertRole(
  authContext: OCPIAuthorizerContext,
  requiredRole: string,
  label: string,
): APIGatewayProxyResult | null {
  if (authContext.role === requiredRole) {
    return null;
  }

  console.warn(
    `[OCPI][${label}] Rejected — role '${authContext.role}' is not allowed, expected '${requiredRole}' (party: ${authContext.partnerId})`,
  );
  return ErrorHandler.handleBadRequestError(
    2000,
    `Only ${requiredRole}s are allowed to perform this operation.`,
    405,
  );
}

/** Enforces Client Owned Objects: authenticated party must own the namespace in the path. */
export function assertOwnership(
  authContext: OCPIAuthorizerContext,
  pathCountryCode: string | undefined,
  pathPartyId: string | undefined,
  label: string,
): APIGatewayProxyResult | null {
  if (
    authContext.country_code === pathCountryCode &&
    authContext.party_id === pathPartyId
  ) {
    return null;
  }

  console.warn(
    `[OCPI][${label}] Rejected — ownership mismatch for ${authContext.partnerId}: auth=${authContext.country_code}/${authContext.party_id}, path=${pathCountryCode}/${pathPartyId}`,
  );
  return ErrorHandler.handleBadRequestError(
    2001,
    'Authenticated party does not own this namespace.',
  );
}

/** Enforces that path identifiers match the body identifiers (country_code, party_id, id). */
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
