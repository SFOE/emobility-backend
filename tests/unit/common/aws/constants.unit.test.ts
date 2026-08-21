import { Aws } from '/opt/nodejs/aws/constants';

const SWISSTOPO_ENV_VARS = [
  'SWISSTOPO_BUCKET_NAME',
  'SWISSTOPO_GEOJSON_KEY_PREFIX',
  'SWISSTOPO_CREDENTIALS_SECRET_NAME',
];

describe('Aws.swisstopoConfig', () => {
  beforeEach(() => {
    for (const name of SWISSTOPO_ENV_VARS) {
      delete process.env[name];
    }
  });

  it('is undefined when swisstopo is not configured', () => {
    expect(Aws.swisstopoConfig).toBeUndefined();
  });

  it('returns the full config when all variables are set', () => {
    process.env.SWISSTOPO_BUCKET_NAME = 'data.geo.admin.ch';
    process.env.SWISSTOPO_GEOJSON_KEY_PREFIX =
      'ch.bfe.ladestellen-elektromobilitaet/test';
    process.env.SWISSTOPO_CREDENTIALS_SECRET_NAME = 'SWISSTOPO_CREDENTIALS';

    expect(Aws.swisstopoConfig).toEqual({
      bucketName: 'data.geo.admin.ch',
      geoJsonKeyPrefix: 'ch.bfe.ladestellen-elektromobilitaet/test',
      credentialsSecretName: 'SWISSTOPO_CREDENTIALS',
      bucketRegion: 'eu-west-1',
    });
  });

  it('throws naming the missing variables when only partially configured', () => {
    process.env.SWISSTOPO_BUCKET_NAME = 'data.geo.admin.ch';

    expect(() => Aws.swisstopoConfig).toThrow(
      'Incomplete swisstopo configuration: missing SWISSTOPO_GEOJSON_KEY_PREFIX, SWISSTOPO_CREDENTIALS_SECRET_NAME',
    );
  });
});
