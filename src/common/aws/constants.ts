export const Aws = {
  region: 'eu-central-1',
  rawDataBucketName: 'emobility-dev-ocpi-rawdata-bucket',
  ingestionQueueUrl:
    'https://sqs.eu-central-1.amazonaws.com/312605937711/emobility-dev-ocpi-ingestion-queue',
  dynamoDBTables: {
    versions: 'ocpi-versions',
    credentials: 'ocpi-credentials',
  },
};
