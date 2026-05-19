import { OCPICredential } from '../../../src/common/modules/ocpi-credentials/ocpi-credentials.model';

// Partner credential sent in the request body (token = TOKEN_B).
export const VALID_CREDENTIAL: OCPICredential = {
  token: 'partner-token-b',
  url: 'https://partner.example.com/ocpi/versions',
  roles: [
    {
      role: 'CPO',
      party_id: 'XYZ',
      country_code: 'DE',
      business_details: { name: 'Partner CPO GmbH' },
    },
  ],
};

// Token used in the Authorization header (without 'Token ' prefix).
export const BOOTSTRAP_TOKEN = 'bootstrap-token-hex';

// Secrets Manager path derived from the primary role of VALID_CREDENTIAL.
const { role, country_code, party_id } = VALID_CREDENTIAL.roles[0];
export const SECRET_ID = `/emobility/ocpi/parties/${role}/${country_code}/${party_id}`;
