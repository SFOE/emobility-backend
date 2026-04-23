import {
  SecretsManagerClient,
  CreateSecretCommand,
} from '@aws-sdk/client-secrets-manager';
import { Aws } from '/opt/nodejs/aws.constants';
import { OCPICredentialRole } from '/opt/nodejs/db/ocpi-credentials/ocpi-credentials.model';

const secretsClient = new SecretsManagerClient({ region: Aws.region });

/**
 * The secret value stored per OCPI party in AWS Secrets Manager.
 * - CREDENTIALS_TOKEN_B: the token the party sent us during the credentials handshake
 * - CREDENTIALS_TOKEN_C: the new token we generated and returned to the party
 */
export interface OCPIPartySecretValue {
  CREDENTIALS_TOKEN_B: string;
  CREDENTIALS_TOKEN_C: string;
}

/**
 * Persists both OCPI tokens for a party as a new secret in AWS Secrets Manager.
 *
 * The secret is stored under a deterministic path based on the party's role,
 * country code, and party ID, e.g.: /emobility/ocpi/parties/CPO/CH/XYZ
 *
 * This function is only called once per party during the initial credentials
 * handshake. Re-registration is prevented upstream by invalidating the
 * bootstrap token after first use.
 *
 * @param role   - The OCPI role of the party (CPO, EMSP, etc.)
 * @returns The secret name (path), which is stored as a reference in DynamoDB
 *          instead of the plaintext token
 */
export const savePartySecret = async (
  role: OCPICredentialRole,
  tokenB: string,
  tokenC: string,
): Promise<string> => {
  const secretName = `/emobility/ocpi/parties/${role.role}/${role.country_code}/${role.party_id}`;
  const secretValue: OCPIPartySecretValue = {
    CREDENTIALS_TOKEN_B: tokenB,
    CREDENTIALS_TOKEN_C: tokenC,
  };
  const secretString = JSON.stringify(secretValue);

  await secretsClient.send(
    new CreateSecretCommand({
      Name: secretName,
      SecretString: secretString,
    }),
  );

  // Return the secret name so it can be stored as a reference in DynamoDB
  return secretName;
};
