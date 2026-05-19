import { OCPICredentialRole } from '/opt/nodejs/modules/ocpi-credentials/ocpi-credentials.model';

export const SUPPORTED_VERSIONS = ['2.2.1', '2.3.0'];

export const BFE_ROLE: OCPICredentialRole = {
  role: 'NAP',
  business_details: {
    name: 'Bundesamt für Energie',
  },
  party_id: 'BFE',
  country_code: 'CH',
};

export const BFE_HUB_PARTY_ID = `${BFE_ROLE.country_code}${BFE_ROLE.party_id}`;