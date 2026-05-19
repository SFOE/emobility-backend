import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { getRequiredLambdaEnv } from '/opt/nodejs/utils/api.utils';

export const Aws = {
  region: process.env.AWS_REGION ?? 'eu-central-1',
  rawDataBucketName: getRequiredLambdaEnv('RAW_DATA_BUCKET_NAME'),  // emobility-dev-ocpi-rawdata-bucket
  ingestionQueueUrl: getRequiredLambdaEnv('INGESTION_QUEUE_URL'), // https://sqs.eu-central-1.amazonaws.com/312605937711/emobility-dev-ocpi-ingestion-queue
  dynamoDBTables: {
      versions: 'ocpi-versions',
      credentials: 'ocpi-credentials',
  },
};

const dynamoDBClient = new DynamoDBClient({ region: Aws.region });
export const dynamoDocClient = DynamoDBDocument.from(dynamoDBClient);
