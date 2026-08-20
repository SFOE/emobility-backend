import { getRequiredLambdaEnv } from '/opt/nodejs/utils/api.utils';

export interface SwisstopoConfig {
  bucketName: string;
  geoJsonKeyPrefix: string;
  credentialsSecretName: string;
  bucketRegion: string;
}

const SWISSTOPO_BUCKET_REGION = 'eu-west-1';
const SWISSTOPO_ENV_VARS = [
  'SWISSTOPO_BUCKET_NAME',
  'SWISSTOPO_GEOJSON_KEY_PREFIX',
  'SWISSTOPO_CREDENTIALS_SECRET_NAME',
] as const;

export const Aws = {
  get rawDataBucketName(): string {
    return getRequiredLambdaEnv('RAW_DATA_BUCKET_NAME');
  },
  get ingestionQueueUrl(): string {
    return (
      process.env.SQS_INGESTION_QUEUE_URL ??
      getRequiredLambdaEnv('INGESTION_QUEUE_URL')
    );
  },
  get dataLakeHouseLandingZoneBucketName(): string {
    return getRequiredLambdaEnv('DATA_LAKE_HOUSE_LANDING_ZONE_BUCKET_NAME');
  },
  get crossAccountRoleLandingZoneArn(): string {
    return getRequiredLambdaEnv('CROSS_ACCOUNT_ROLE_LANDING_ZONE_ARN');
  },
  /**
   * Config of the swisstopo bucket (data.geo.admin.ch) that serves the
   * published GeoJSON on geo.admin.ch, or `undefined` when the swisstopo
   * publication is not configured for this environment. A partially
   * configured variable set is a deployment error and throws.
   */
  get swisstopoConfig(): SwisstopoConfig | undefined {
    const missing = SWISSTOPO_ENV_VARS.filter((name) => !process.env[name]);
    if (missing.length === SWISSTOPO_ENV_VARS.length) {
      return undefined;
    }
    if (missing.length > 0) {
      throw new Error(
        `Incomplete swisstopo configuration: missing ${missing.join(', ')}`,
      );
    }
    return {
      bucketName: getRequiredLambdaEnv('SWISSTOPO_BUCKET_NAME'),
      geoJsonKeyPrefix: getRequiredLambdaEnv('SWISSTOPO_GEOJSON_KEY_PREFIX'),
      credentialsSecretName: getRequiredLambdaEnv(
        'SWISSTOPO_CREDENTIALS_SECRET_NAME',
      ),
      bucketRegion: SWISSTOPO_BUCKET_REGION,
    };
  },
  region: 'eu-central-1',
  s3Config: {
    region: 'eu-central-1',
    forcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === 'true',
  },
  dynamoDBTables: {
    versions: 'ocpi-versions',
    credentials: 'ocpi-credentials',
    evseCurrentStatus: 'ocpi-evse-current-status',
  },
};
