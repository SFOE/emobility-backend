import { DbKeys } from '/opt/nodejs/db/base.model';

export interface OCPICredential {
  token: string;
  url: string;
  hub_party_id?: string;
  roles: OCPICredentialRole[];
}

export interface OCPICredentialItem extends OCPICredential, DbKeys {
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
