import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

export const Aws = {
  region: 'eu-central-1',
  rawDataBucketName: 'emobility-dev-ocpi-rawdata-bucket',
  ingestionQueueUrl:
    'https://sqs.eu-central-1.amazonaws.com/312605937711/emobility-dev-ocpi-ingestion-queue',
};

const dynamoDBClient = new DynamoDBClient({ region: Aws.region });
export const dynamoDocClient = DynamoDBDocument.from(dynamoDBClient);
