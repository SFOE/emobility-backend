import { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';

/**
 * Cognito group whose members may read the monitoring data, from the Lambda
 * environment. Empty or unset means no group check (the route has no JWT
 * authorizer yet).
 */
export const monitoringRequiredGroup = (): string =>
  (process.env.MONITORING_REQUIRED_GROUP ?? '').trim();

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
 * required, otherwise only with that group in the token.
 */
export const hasMonitoringAccess = (
  event: Partial<APIGatewayProxyEventV2WithJWTAuthorizer> | undefined,
  requiredGroup: string = monitoringRequiredGroup(),
): boolean => {
  if (!requiredGroup) {
    return true;
  }
  const claims = event?.requestContext?.authorizer?.jwt?.claims;
  return groupsFromClaims(claims).includes(requiredGroup);
};
