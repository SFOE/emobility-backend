import { getRequiredLambdaEnv } from '/opt/nodejs/utils/api.utils';

export const Aws = {
  region: process.env.AWS_REGION ?? 'eu-central-1',
  rawDataBucketName: getRequiredLambdaEnv('RAW_DATA_BUCKET_NAME'),  // emobility-{env}-ocpi-rawdata-bucket
  ingestionQueueUrl: getRequiredLambdaEnv('INGESTION_QUEUE_URL'), // e.g. https://sqs.eu-central-1.amazonaws.com/312605937711/emobility-dev-ocpi-ingestion-queue
  region: 'eu-central-1',
  rawDataBucketName: 'emobility-dev-ocpi-rawdata-bucket',
  s3Config: {
    region: 'eu-central-1',
    forcePathStyle: !!process.env.AWS_ENDPOINT_URL_S3,
    ...(process.env.AWS_ENDPOINT_URL_S3 && { endpoint: process.env.AWS_ENDPOINT_URL_S3 }),
  },
  ingestionQueueUrl:
    process.env.SQS_INGESTION_QUEUE_URL ??
    'https://sqs.eu-central-1.amazonaws.com/312605937711/emobility-dev-ocpi-ingestion-queue',
  dynamoDBTables: {
      versions: 'ocpi-versions',
      credentials: 'ocpi-credentials',
  },
};