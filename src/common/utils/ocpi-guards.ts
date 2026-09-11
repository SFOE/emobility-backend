import { APIGatewayProxyResult } from 'aws-lambda';
import { APIGatewayProxyEventV2WithLambdaAuthorizer } from 'aws-lambda/trigger/api-gateway-proxy';
import { OCPIAuthorizerContext } from '/opt/nodejs/api/base.model';
import { ErrorHandler } from '/opt/nodejs/api/error/api-error-handler';
import { SUPPORTED_VERSIONS } from '/opt/nodejs/config.constants';
import {
  OCPI_ROLES,
  OCPICredential,
  OCPICredentialRole,
  OCPIRole,
} from '/opt/nodejs/modules/ocpi-credentials/ocpi-credentials.model';

// Types
export interface OcpiPathParams {
  country_code?: string;
  party_id?: string;
  location_id?: string;
  evse_uid?: string;
  connector_id?: string;
  tariff_id?: string;
}

export type OCPIHandler = (
  event: APIGatewayProxyEventV2WithLambdaAuthorizer<OCPIAuthorizerContext>,
  authContext: OCPIAuthorizerContext,
  ocpiVersion: string,
  pathParams: OcpiPathParams,
) => Promise<APIGatewayProxyResult>;

export type GuardFn = (
  event: APIGatewayProxyEventV2WithLambdaAuthorizer<OCPIAuthorizerContext>,
  authContext: OCPIAuthorizerContext,
) => APIGatewayProxyResult | null;

/**
 * Reads the OCPI path parameters once. country_code and party_id are CiString
 * and normalized to uppercase, so they stay consistent everywhere they become
 * S3 partitions, DynamoDB keys and metric dimensions.
 */
export const parsePathParams = (event: {
  pathParameters?: { [name: string]: string | undefined } | null;
}): OcpiPathParams => {
  const params = event.pathParameters ?? {};
  return {
    country_code: params.country_code?.toUpperCase(),
    party_id: params.party_id?.toUpperCase(),
    location_id: params.location_id,
    evse_uid: params.evse_uid,
    connector_id: params.connector_id,
    tariff_id: params.tariff_id,
  };
};

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

    // Parse, normalize (uppercase cc/party) and validate the path identifiers
    // once, then hand the result to the handler.
    const pathParams = parsePathParams(event);
    const idError = assertValidPathIdentifiers(
      pathParams,
      event.routeKey,
      authContext.partnerId,
    );
    if (idError) {
      return idError;
    }

    return handler(event, authContext, version, pathParams);
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
  // country_code and party_id are CiString (case-insensitive) per OCPI; compare
  // them case-insensitively. The resource id stays an exact match.
  if (
    body.country_code?.toUpperCase() === pathCountryCode?.toUpperCase() &&
    body.party_id?.toUpperCase() === pathPartyId?.toUpperCase() &&
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

// Printable ASCII (OCPI CiString) excluding characters that would break S3 keys,
// Hive partitions or DynamoDB composite keys: whitespace, '/', '#', '='.
const isKeySafeId = (value: string, minLen: number, maxLen: number): boolean =>
  value.length >= minLen &&
  value.length <= maxLen &&
  /^[\x21-\x7E]+$/.test(value) &&
  !/[/#=]/.test(value);

// Validates the OCPI path identifiers before they are used to build S3 keys and
// DynamoDB keys. Only the fields present on the current route are checked.
export function assertValidPathIdentifiers(
  params: OcpiPathParams,
  label: string,
  partnerId: string,
): APIGatewayProxyResult | null {
  const fields: Array<{
    name: string;
    value?: string;
    min: number;
    max: number;
  }> = [
    { name: 'country_code', value: params.country_code, min: 2, max: 2 },
    { name: 'party_id', value: params.party_id, min: 3, max: 3 },
    { name: 'location_id', value: params.location_id, min: 1, max: 36 },
    { name: 'evse_uid', value: params.evse_uid, min: 1, max: 36 },
    { name: 'connector_id', value: params.connector_id, min: 1, max: 36 },
    { name: 'tariff_id', value: params.tariff_id, min: 1, max: 36 },
  ];

  for (const field of fields) {
    if (field.value === undefined) {
      continue; // not part of this route
    }
    if (!isKeySafeId(field.value, field.min, field.max)) {
      console.error(
        `[OCPI][${label}] Rejected — invalid ${field.name} '${field.value}' from ${partnerId}`,
      );
      return ErrorHandler.handleBadRequestError(
        2001,
        `Invalid ${field.name}: must be printable ASCII without whitespace, '/', '#' or '='.`,
      );
    }
  }

  return null;
}
