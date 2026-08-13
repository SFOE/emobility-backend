import { getRequiredLambdaEnv } from '/opt/nodejs/utils/api.utils';

export const Aws = {
  get rawDataBucketName(): string { return getRequiredLambdaEnv('RAW_DATA_BUCKET_NAME'); },
  get ingestionQueueUrl(): string { return process.env.SQS_INGESTION_QUEUE_URL ?? getRequiredLambdaEnv('INGESTION_QUEUE_URL'); },
  get dataLakeHouseLandingZoneBucketName(): string { return getRequiredLambdaEnv('DATA_LAKE_HOUSE_LANDING_ZONE_BUCKET_NAME'); },
  get crossAccountRoleLandingZoneArn(): string { return getRequiredLambdaEnv('CROSS_ACCOUNT_ROLE_LANDING_ZONE_ARN'); },
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
