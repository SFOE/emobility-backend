import { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';

/**
 * Cognito group whose members may read the monitoring data, from the Lambda
 * environment. Empty or unset means no group check (the route has no JWT
 * authorizer yet).
 */
export const monitoringRequiredGroup = (): string =>
  (process.env.MONITORING_REQUIRED_GROUP ?? '').trim();

/**
 * E-mail addresses that may read the monitoring data without the group, from
 * the Lambda environment as a comma-separated list (the platform developers,
 * who sign in with AGOV but are not BFE staff). Lower-cased for comparison.
 */
export const monitoringAllowedEmails = (): string[] =>
  (process.env.MONITORING_ALLOWED_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);

/** The `email` claim of the access token, lower-cased; `null` without one. */
export const emailFromClaims = (
  claims: Record<string, unknown> | undefined,
): string | null => {
  const raw = claims?.email;
  return typeof raw === 'string' && raw.trim()
    ? raw.trim().toLowerCase()
    : null;
};

/**
 * The `cognito:groups` claim of the access token the API Gateway JWT
 * authorizer validated. API Gateway passes an array claim as a string in the
 * form "[group-a group-b]"; a real array is accepted as well.
 */
export const groupsFromClaims = (
  claims: Record<string, unknown> | undefined,
): string[] => {
  const raw = claims?.['cognito:groups'];
  if (Array.isArray(raw)) {
    return raw.map(String);
  }
  if (typeof raw !== 'string') {
    return [];
  }
  return raw
    .replace(/^\[|\]$/g, '')
    .split(/[\s,]+/)
    .filter((group) => group.length > 0);
};

/**
 * Whether the caller may read the monitoring data: always, if no group is
 * required, otherwise with that group in the token or with an e-mail address
 * from the allowed list.
 */
export const hasMonitoringAccess = (
  event: Partial<APIGatewayProxyEventV2WithJWTAuthorizer> | undefined,
  requiredGroup: string = monitoringRequiredGroup(),
  allowedEmails: string[] = monitoringAllowedEmails(),
): boolean => {
  if (!requiredGroup) {
    return true;
  }
  const claims = event?.requestContext?.authorizer?.jwt?.claims;
  if (groupsFromClaims(claims).includes(requiredGroup)) {
    return true;
  }
  const email = emailFromClaims(claims);
  return email !== null && allowedEmails.includes(email);
};
