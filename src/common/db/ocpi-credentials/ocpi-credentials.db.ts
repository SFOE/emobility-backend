import { saveItem } from '/opt/nodejs/db/db-requests';
import { OCPI_CREDENTIALS_TABLE_NAME } from '/opt/nodejs/db/db-table-names.constants';
import {
  OCPICredential,
  OCPICredentialItem,
} from '/opt/nodejs/db/ocpi-credentials/ocpi-credentials.model';
import { hashToken } from '/opt/nodejs/utils/crypto.utils';

export const saveCredentials = async (
  credentials: OCPICredential,
  generatedToken: string,
): Promise<void> => {
  // hash new generated access token
  const tokenHash = hashToken(generatedToken);
  const credentialItem: OCPICredentialItem = {
    pk: `TOKEN#${tokenHash}`,
    sk: 'CREDENTIALS',
    token: credentials.token,
    url: credentials.url,
    roles: credentials.roles,
    createdAt: new Date().toISOString(),
  };

  // store new credentials of the cpo
  await saveItem<OCPICredentialItem>(
    OCPI_CREDENTIALS_TABLE_NAME,
    credentialItem,
  );
};
