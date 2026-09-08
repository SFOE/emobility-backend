import {
  OCPICredentialItem,
  OCPICredentialRole,
} from '/opt/nodejs/modules/ocpi-credentials/ocpi-credentials.model';

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

export interface OcpiPathParams {
  country_code?: string;
  party_id?: string;
  location_id?: string;
  evse_uid?: string;
  connector_id?: string;
  tariff_id?: string;
}

/**
 * Reads the OCPI path parameters once. country_code and party_id are CiString
 * and normalized to uppercase, so they stay consistent everywhere they become
 * S3 partitions, DynamoDB keys, object_ids and metric dimensions.
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
