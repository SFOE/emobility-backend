import {
  SecretsManagerClient,
  CreateSecretCommand,
  UpdateSecretCommand,
  ResourceExistsException,
} from '@aws-sdk/client-secrets-manager';
import { Aws } from '/opt/nodejs/aws.constants';
import { OCPICredentialRole } from '/opt/nodejs/db/ocpi-credentials/ocpi-credentials.model';

const secretsClient = new SecretsManagerClient({ region: Aws.region });

export interface OCPIPartySecretValue {
  CREDENTIALS_TOKEN_B: string;
  CREDENTIALS_TOKEN_C: string;
}

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

  try {
    await secretsClient.send(
      new CreateSecretCommand({
        Name: secretName,
        SecretString: secretString,
      }),
    );
  } catch (err) {
    if (err instanceof ResourceExistsException) {
      await secretsClient.send(
        new UpdateSecretCommand({
          SecretId: secretName,
          SecretString: secretString,
        }),
      );
    } else {
      throw err;
    }
  }

  return secretName;
};
