import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { Aws } from '/opt/nodejs/aws.constants';

const s3Client = new S3Client({ region: Aws.region });
const sqsClient = new SQSClient({ region: Aws.region });

export type IngestionAction = 'PUT' | 'PATCH' | 'DELETE';
export type IngestionObjectType = 'tariffs' | 'locations';

export interface IngestionEvent {
  action: IngestionAction;
  type: IngestionObjectType;
  object_id: string;
  country_code: string;
  party_id: string;
  ocpi_version: string;
  received_at: string;
  raw: {
    bucket: string;
    key: string;
  } | null;
}

/**
 * Builds the S3 object key for a raw ingestion payload.
 *
 * Format: {type}/year={YYYY}/month={MM}/day={DD}/{country_code}_{party_id}_{object_id}_{action}_{timestamp}.json
 */
const buildS3Key = (
  type: IngestionObjectType,
  action: IngestionAction,
  countryCode: string,
  partyId: string,
  objectId: string,
  timestamp: Date,
): string => {
  const year = timestamp.getUTCFullYear();
  const month = String(timestamp.getUTCMonth() + 1).padStart(2, '0');
  const day = String(timestamp.getUTCDate()).padStart(2, '0');
  const ts = timestamp.toISOString().replace(/[:.]/g, '').replace('Z', 'Z');
  return `${type}/year=${year}/month=${month}/day=${day}/${countryCode}_${partyId}_${objectId}_${action}_${ts}.json`;
};

/**
 * Writes the raw request payload as-is to the S3 raw data bucket.
 * Returns the S3 key of the stored object.
 */
export const putRawToS3 = async (
  payload: unknown,
  type: IngestionObjectType,
  action: IngestionAction,
  countryCode: string,
  partyId: string,
  objectId: string,
  receivedAt: string,
): Promise<string> => {
  const bucket = Aws.rawDataBucketName;
  const key = buildS3Key(type, action, countryCode, partyId, objectId, new Date(receivedAt));

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(payload),
      ContentType: 'application/json',
    }),
  );

  return key;
};

/**
 * Publishes an ingestion event to the SQS queue so the Lambda Loader
 * can pick up the raw object and write it to the Data Lakehouse.
 */
export const publishIngestionEvent = async (event: IngestionEvent): Promise<void> => {
  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: Aws.ingestionQueueUrl,
      MessageBody: JSON.stringify(event),
    }),
  );
};
