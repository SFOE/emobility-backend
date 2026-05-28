import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';
import { Aws } from '/opt/nodejs/aws/constants';
import { IngestionAction, IngestionObjectType } from '/opt/nodejs/aws/sqs';
import { gzipSync } from 'node:zlib';

// forcePathStyle is required when a custom S3 endpoint is set (e.g. in integration tests against Ministack),
// because virtual-hosted-style URLs (bucket.localhost) do not resolve via DNS.
const s3Client = new S3Client(Aws.s3Config);

// Extracts UTC date parts and a safe ISO timestamp string from a Date object.
const buildDatePartitions = (timestamp: Date) => ({
  year: timestamp.getUTCFullYear(),
  month: String(timestamp.getUTCMonth() + 1).padStart(2, '0'),
  day: String(timestamp.getUTCDate()).padStart(2, '0'),
  ts: timestamp.toISOString().replace(/[:.]/g, ''), // colons/dots removed for safe S3 filenames
});

// Builds an S3 key with Hive-style partitions (year/month/day/country/party + resource segments) for Athena/Glue auto-discovery.
const buildS3Key = (
  type: IngestionObjectType,
  action: IngestionAction,
  countryCode: string,
  partyId: string,
  resourceSegments: string[],
  timestamp: Date,
): string => {
  const { year, month, day, ts } = buildDatePartitions(timestamp);
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

// Builds a time-partitioned Landing Zone S3 key for one batch.
// Example: ocpi-raw/year=2026/month=05/day=28/20260528T112631000Z.jsonl.gz
// The Landing Zone is a raw transient dump — module, action, country and party are stored in each record and processed in the Bronze ETL.
export const buildLandingZoneKey = (timestamp: Date): string => {
  const { year, month, day, ts } = buildDatePartitions(timestamp);
  return `ocpi-raw/year=${year}/month=${month}/day=${day}/${ts}.jsonl.gz`;
};

// Assumes a cross-account IAM role via STS and returns a new S3Client with the temporary credentials.
export const createCrossAccountS3Client = async (roleArn: string): Promise<S3Client> => {
  const stsClient = new STSClient({ region: Aws.region });
  const { Credentials } = await stsClient.send(new AssumeRoleCommand({
    RoleArn: roleArn,
    RoleSessionName: 'ocpi-raw-data-loader',
  }));

  return new S3Client({
    ...Aws.s3Config,
    credentials: {
      accessKeyId: Credentials!.AccessKeyId!,
      secretAccessKey: Credentials!.SecretAccessKey!,
      sessionToken: Credentials!.SessionToken,
    },
  });
};

// Serializes records as JSONL, gzip-compresses and uploads to S3. Accepts an optional client for cross-account writes.
export async function putJsonLinesGzipToS3(
    bucketName: string,
    key: string,
    records: unknown[],
    client: S3Client = s3Client,
): Promise<void> {
  const jsonLines = records.map((record) => JSON.stringify(record)).join('\n') + '\n';
  const compressedBody = gzipSync(jsonLines);

  await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: compressedBody,
        ContentType: 'application/jsonl',
        ContentEncoding: 'gzip',
      }),
  );
}