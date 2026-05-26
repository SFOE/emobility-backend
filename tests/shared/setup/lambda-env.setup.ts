
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

process.env.DATA_LAKE_HOUSE_LANDING_ZONE_BUCKET_NAME =
    process.env.DATA_LAKE_HOUSE_LANDING_ZONE_BUCKET_NAME ??
    'emobility-test-landing-zone-bucket';

process.env.CROSS_ACCOUNT_ROLE_LANDING_ZONE_ARN =
    process.env.CROSS_ACCOUNT_ROLE_LANDING_ZONE_ARN ??
    'arn:aws:iam::000000000000:role/test-landing-zone-role';