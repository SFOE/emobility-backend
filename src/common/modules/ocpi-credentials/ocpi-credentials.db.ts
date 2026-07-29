import { queryBySk, saveItem, updateItem, deleteItem } from '/opt/nodejs/aws/dynamodb';
import { Aws } from '/opt/nodejs/aws/constants';

const TABLE = Aws.dynamoDBTables.credentials;
import {
  OCPICredential,
  OCPICredentialItem,
} from '/opt/nodejs/modules/ocpi-credentials/ocpi-credentials.model';
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
  await saveItem(TABLE, credentialItem);
};

export const getCredentials = async (
    token: string,
): Promise<OCPICredentialItem | null> => {
  const credentials = await queryBySk<OCPICredentialItem>(
      TABLE,
      `TOKEN#${hashToken(token)}`,
      'CREDENTIALS',
  );
  if (credentials) {
    return credentials;
  }

  // Some CPOs Base64-encode the token before sending it (per OCPI 2.2+).
  // Retry with the decoded value in case the raw token yielded no match.
  const decodedToken = decodeBase64Token(token);
  if (!decodedToken || decodedToken === token) {
    return null;
  }

  return await queryBySk<OCPICredentialItem>(
      TABLE,
      `TOKEN#${hashToken(decodedToken)}`,
      'CREDENTIALS',
  );
};

/**
 * Attempts to Base64-decode a token. Returns null when the input is not valid
 * Base64 (i.e. re-encoding the decoded value does not reproduce the input).
 */
const decodeBase64Token = (token: string): string | null => {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    if (Buffer.from(decoded, 'utf8').toString('base64') !== token) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
};

export const invalidateBootstrapToken = async (token: string): Promise<void> => {
  const tokenHash = hashToken(token);

  await updateItem(
      TABLE,
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
  await saveItem(TABLE, credentialItem);

  // Remove the old mapping so the previous TOKEN_C no longer works.
  await deleteItem(TABLE, oldCredentialPk, 'CREDENTIALS');

  return credentialItem;
};

/**
 * Deletes an OCPI credentials mapping from DynamoDB.
 *
 * This removes the token lookup item so the related TOKEN_C can no longer be used.
 */
export const deleteCredentials = async (
    credentialPk: string,
): Promise<void> => {
  await deleteItem(TABLE, credentialPk, 'CREDENTIALS');
};