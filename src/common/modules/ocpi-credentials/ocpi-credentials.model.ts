import { DbKeys } from '/opt/nodejs/aws/dynamodb';

export interface OCPICredential {
  token: string;
  url: string;
  hub_party_id?: string;
  roles: OCPICredentialRole[];
}

export interface OCPICredentialItem extends DbKeys {
  secretRef: string;
  url: string;
  hub_party_id?: string;
  roles: OCPICredentialRole[];
  bootstrapToken?: boolean;
  createdAt: string;
}

export interface OCPICredentialRole {
  role: OCPIRole;
  business_details: {
    name: string;
    website?: string;
  };
  party_id: string;
  country_code: string;
}

export type OCPIRole = 'CPO' | 'EMSP' | 'NAP' | 'NSP' | 'OTHER' | 'SCSP';