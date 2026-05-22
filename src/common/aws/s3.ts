import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Aws } from '/opt/nodejs/aws/constants';
import { IngestionAction, IngestionObjectType } from '/opt/nodejs/aws/sqs';
import { gzipSync } from 'node:zlib';

// forcePathStyle is required when a custom S3 endpoint is set (e.g. in integration tests against Ministack),
// because virtual-hosted-style URLs (bucket.localhost) do not resolve via DNS.
const s3Client = new S3Client(Aws.s3Config);

// Builds an S3 key with Hive-style partitions (year/month/day/country/party + resource segments) for Athena/Glue auto-discovery.
const buildS3Key = (
  type: IngestionObjectType,
  action: IngestionAction,
  countryCode: string,
  partyId: string,
  resourceSegments: string[],
  timestamp: Date,
): string => {
  const year = timestamp.getUTCFullYear();
  const month = String(timestamp.getUTCMonth() + 1).padStart(2, '0');
  const day = String(timestamp.getUTCDate()).padStart(2, '0');
  const ts = timestamp.toISOString().replace(/[:.]/g, '').replace('Z', 'Z');
  const resource = resourceSegments.join('/');
  return `${type}/year=${year}/month=${month}/day=${day}/country=${countryCode}/party=${partyId}/${resource}/${action}_${ts}.json`;
};

// Writes the raw payload to S3 and returns the object key.
export const putRawToS3 = async (
  payload: unknown,
  type: IngestionObjectType,
  action: IngestionAction,
  countryCode: string,
  partyId: string,
  resourceSegments: string[],
  receivedAt: string,
): Promise<string> => {
  const bucket = Aws.rawDataBucketName;
  const key = buildS3Key(
    type,
    action,
    countryCode,
    partyId,
    resourceSegments,
    new Date(receivedAt),
  );

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

// Fetches and JSON-parses a raw object from S3. Throws on SDK or parse errors.
export const getRawFromS3 = async (
  bucket: string,
  key: string,
): Promise<unknown> => {
  const response = await s3Client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  const body = await response.Body!.transformToString();
  return JSON.parse(body);
};

/**
 * Serializes multiple records into JSON Lines format, compresses the result
 * using gzip and uploads the batch file to S3 for downstream data lake ingestion.
 */
export async function putJsonLinesGzipToS3(
    bucketName: string,
    key: string,
    records: unknown[],
): Promise<void> {
  const jsonLines = records.map((record) => JSON.stringify(record)).join('\n') + '\n';

  const compressedBody = gzipSync(jsonLines);

  await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: compressedBody,
        ContentType: 'application/jsonl',
        ContentEncoding: 'gzip',
      }),
  );
}