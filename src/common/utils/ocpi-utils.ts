import {
  OCPICredential,
  OCPICredentialItem,
  OCPICredentialRole
} from '/opt/nodejs/db/ocpi-credentials/ocpi-credentials.model';

export function validateCredentialsPayload(credentials: OCPICredential, primaryRole: OCPICredentialRole | undefined): string | null {
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

export const getPrimaryRole = (credentials: OCPICredentialItem): OCPICredentialRole | null => {
  if (!credentials?.roles?.length) {
    return null;
  }
  return credentials.roles.find((r) => r.role === 'CPO') ?? credentials.roles[0];
};

export const getPartnerId = (credentials: OCPICredentialItem): string => {
  const primary = getPrimaryRole(credentials);
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
