import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { getS3AccessKeySecret } from '/opt/nodejs/aws/secrets-manager';

const SECRET_ID = 'SWISSTOPO_BUCKET_LADESTELLEN_ELEKTROMOBILITAET_CREDENTIALS';

const sendSpy = jest.spyOn(
  SecretsManagerClient.prototype,
  'send',
) as unknown as jest.Mock;

describe('getS3AccessKeySecret', () => {
  beforeEach(() => {
    sendSpy.mockReset();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('parses the access keys from the JSON secret', async () => {
    sendSpy.mockResolvedValue({
      SecretString: JSON.stringify({
        ACCESS_KEY_ID: 'AKIAEXAMPLE',
        SECRET_ACCESS_KEY: 'super-secret',
      }),
    });

    const secret = await getS3AccessKeySecret(SECRET_ID);

    expect(secret).toEqual({
      ACCESS_KEY_ID: 'AKIAEXAMPLE',
      SECRET_ACCESS_KEY: 'super-secret',
    });
    expect(sendSpy.mock.calls[0]![0].input).toEqual({ SecretId: SECRET_ID });
  });

  it('throws when the secret has no value', async () => {
    sendSpy.mockResolvedValue({});

    await expect(getS3AccessKeySecret(SECRET_ID)).rejects.toThrow(
      `Secret ${SECRET_ID} has no SecretString value.`,
    );
  });

  it('throws when a required key is missing', async () => {
    sendSpy.mockResolvedValue({
      SecretString: JSON.stringify({ ACCESS_KEY_ID: 'AKIAEXAMPLE' }),
    });

    await expect(getS3AccessKeySecret(SECRET_ID)).rejects.toThrow(
      `Secret ${SECRET_ID} is missing ACCESS_KEY_ID or SECRET_ACCESS_KEY.`,
    );
  });

  it('propagates SDK errors instead of returning null', async () => {
    sendSpy.mockRejectedValue(new Error('AccessDeniedException'));

    await expect(getS3AccessKeySecret(SECRET_ID)).rejects.toThrow(
      'AccessDeniedException',
    );
  });
});
