import { getRequiredLambdaEnv } from '/opt/nodejs/utils/api.utils';

export const Aws = {
  rawDataBucketName: getRequiredLambdaEnv('RAW_DATA_BUCKET_NAME'),
  ingestionQueueUrl: process.env.SQS_INGESTION_QUEUE_URL ?? getRequiredLambdaEnv('INGESTION_QUEUE_URL'),
  region: 'eu-central-1',
  s3Config: {
    region: 'eu-central-1',
    forcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === 'true',
  },
  dynamoDBTables: {
      versions: 'ocpi-versions',
      credentials: 'ocpi-credentials',
  },
};