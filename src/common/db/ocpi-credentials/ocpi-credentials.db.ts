import {saveItem} from '/opt/nodejs/db/db-requests';
import {OCPI_CREDENTIALS_TABLE_NAME} from '/opt/nodejs/db/db-table-names.constants';
import {OCPICredential, OCPICredentialItem} from "/opt/nodejs/db/ocpi-credentials/ocpi-credentials.model";

export const registerCPO = async (
    credentials: OCPICredential,
): Promise<void> => {
    const generatedToken = 'NEW_TOKEN_123';
    const credentialItem: OCPICredentialItem = {
        pk: `TOKEN#${generatedToken}`,
        sk: "CREDENTIALS",
        token: generatedToken,
        partyAccessToken: credentials.token,
        url: credentials.url,
        roles: credentials.roles,
        createdAt: new Date().toISOString(),
    }

    await saveItem<OCPICredentialItem>(OCPI_CREDENTIALS_TABLE_NAME, credentialItem);
};
