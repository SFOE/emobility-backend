import { OCPICredentialItem, OCPICredentialRole } from '/opt/nodejs/db/ocpi-credentials/ocpi-credentials.model';

export { validateCredentialsPayload } from '/opt/nodejs/utils/ocpi-guards';

export const getPartnerId = (credentials: OCPICredentialItem): string => {
  const primary = getPrimaryRole(credentials.roles);
  if (!primary) {
    return 'unknown';
  }
  return `${primary.role}-${primary.party_id}-${primary.country_code}`;
};

export const extractToken = (authHeader?: string): string | null => {
  if (!authHeader) {
    return null;
  }

  const match = authHeader.match(/^Token\s+(.+)$/i);
  if (!match) {
    return null;
  }

  return match[1].trim();
};

/**
 * Resolves the primary OCPI role from a credentials payload.
 * Prefers CPO and falls back to the first available role.
 */
export const getPrimaryRole = (
    roles: OCPICredentialRole[],
): OCPICredentialRole => {
  return roles?.find((role) => role.role === 'CPO') ?? roles?.[0];
};