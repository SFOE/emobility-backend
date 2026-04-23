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
  tokenB: string;
  tokenC: string;
}

export const savePartySecret = async (
  role: OCPICredentialRole,
  tokenB: string,
  tokenC: string,
): Promise<void> => {
  const secretName = `/emobility/ocpi/parties/${role.role}/${role.country_code}/${role.party_id}`;
  const secretValue: OCPIPartySecretValue = { tokenB, tokenC };
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
};
