
/**
 * Provides required Lambda runtime environment variables for tests.
 *
 * These values emulate the environment variables that are normally injected
 * by Terraform when the Lambda functions run in AWS.
 */
process.env.AWS_REGION = process.env.AWS_REGION ?? 'eu-central-1';

process.env.RAW_DATA_BUCKET_NAME =
    process.env.RAW_DATA_BUCKET_NAME ?? 'emobility-test-ocpi-rawdata-bucket';

process.env.INGESTION_QUEUE_URL =
    process.env.INGESTION_QUEUE_URL ??
    'https://sqs.eu-central-1.amazonaws.com/312605937711/emobility-test-ocpi-ingestion-queue';