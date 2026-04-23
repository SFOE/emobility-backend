import { OCPICredential } from '/opt/nodejs/db/ocpi-credentials/ocpi-credentials.model';

export const getPartnerId = (credentials: OCPICredential): string => {
  if (credentials?.roles?.length > 0) {
    const role =
      credentials.roles.find((role) => role.role === 'CPO') ??
      credentials.roles[0];

    return `${role.role}-${role.party_id}-${role.country_code}`;
  }

  return 'unknown';
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
