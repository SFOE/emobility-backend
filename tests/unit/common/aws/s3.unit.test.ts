import { createStaticCredentialsS3Client } from '/opt/nodejs/aws/s3';

describe('createStaticCredentialsS3Client', () => {
  it('uses the given region and static credentials instead of the default ones', async () => {
    const client = createStaticCredentialsS3Client('eu-west-1', {
      accessKeyId: 'AKIAEXAMPLE',
      secretAccessKey: 'super-secret',
    });

    await expect(client.config.region()).resolves.toBe('eu-west-1');
    await expect(client.config.credentials()).resolves.toMatchObject({
      accessKeyId: 'AKIAEXAMPLE',
      secretAccessKey: 'super-secret',
    });
  });
});
