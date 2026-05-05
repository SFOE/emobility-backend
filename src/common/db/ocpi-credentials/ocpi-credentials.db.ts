import { queryBySk, saveItem, updateItem, deleteItem } from '/opt/nodejs/db/db-requests';
import { OCPI_CREDENTIALS_TABLE_NAME } from '/opt/nodejs/db/db-table-names.constants';
import {
  OCPICredential,
  OCPICredentialItem,
} from '/opt/nodejs/db/ocpi-credentials/ocpi-credentials.model';
import { hashToken } from '/opt/nodejs/utils/crypto.utils';

export const saveNewCredentials = async (
    credentials: OCPICredential,
    generatedToken: string,
    secretRef: string,
): Promise<void> => {
  // hash new generated access token
  const tokenHash = hashToken(generatedToken);
  const credentialItem: OCPICredentialItem = {
    pk: `TOKEN#${tokenHash}`,
    sk: 'CREDENTIALS',
    secretRef: secretRef,
    url: credentials.url,
    hub_party_id: credentials.hub_party_id,
    roles: credentials.roles,
    createdAt: new Date().toISOString(),
  };

  // store new credentials of the cpo
  await saveItem(OCPI_CREDENTIALS_TABLE_NAME, credentialItem);
};

export const getCredentials = async (
    token: string,
): Promise<OCPICredentialItem | null> => {
  const tokenHash = hashToken(token);

  return await queryBySk<OCPICredentialItem>(
      OCPI_CREDENTIALS_TABLE_NAME,
      `TOKEN#${tokenHash}`,
      'CREDENTIALS',
  );
};

export const invalidateBootstrapToken = async (token: string): Promise<void> => {
  const tokenHash = hashToken(token);

  await updateItem(
      OCPI_CREDENTIALS_TABLE_NAME,
      `TOKEN#${tokenHash}`,
      'CREDENTIALS',
      'SET bootstrapToken = :val',
      { ':val': false },
  );
};

/**
 * Rotates the credential lookup token by creating a new DynamoDB item
 * for the new TOKEN_C and deleting the old token mapping.
 */
export const rotateCredentialsToken = async (
    oldCredentialPk: string,
    updatedCredentials: OCPICredential,
    generatedToken: string,
    secretRef: string,
): Promise<OCPICredentialItem> => {
  const newTokenHash = hashToken(generatedToken);

  const credentialItem: OCPICredentialItem = {
    pk: `TOKEN#${newTokenHash}`,
    sk: 'CREDENTIALS',
    secretRef,
    url: updatedCredentials.url,
    hub_party_id: updatedCredentials.hub_party_id,
    roles: updatedCredentials.roles,
    createdAt: new Date().toISOString(),
  };

  // Create the new mapping for the rotated TOKEN_C.
  await saveItem(OCPI_CREDENTIALS_TABLE_NAME, credentialItem);

  // Remove the old mapping so the previous TOKEN_C no longer works.
  await deleteItem(OCPI_CREDENTIALS_TABLE_NAME, oldCredentialPk, 'CREDENTIALS');

  return credentialItem;
};