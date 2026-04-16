export interface OCPICredential {
    token: string;
    url: string;
    hub_party_id?: string;
    roles: OCPICredentialRole[];
}

export interface OCPICredentialItem extends OCPICredential {
    pk: string;
    sk: string;
    partyAccessToken?: string;
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

export type OCPIRole = "CPO" | "EMSP" | "NAP" | "NSP" | "OTHER" | "SCSP";
