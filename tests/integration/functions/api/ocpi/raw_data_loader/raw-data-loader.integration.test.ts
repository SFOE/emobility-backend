// globalSetup sets AWS_ENDPOINT_URL_* before workers spawn, so static SDK clients already point to Ministack.
import {
  CreateBucketCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { gunzipSync } from 'node:zlib';
import { CreateQueueCommand, SQSClient } from '@aws-sdk/client-sqs';
import { SQSEvent, SQSRecord } from 'aws-lambda';
import { handler } from '../../../../../../src/functions/api/ocpi/raw-data-loader/ocpi-raw-data-loader';
import { Aws } from '/opt/nodejs/aws/constants';
import { IngestionEvent } from '/opt/nodejs/aws/sqs';
import { VALID_TARIFF, TARIFF_ID } from '../../../../../shared/test-data/ocpi-tariffs.data';

const BUCKET_NAME = Aws.rawDataBucketName;
const LANDING_ZONE_BUCKET_NAME = Aws.dataLakeHouseLandingZoneBucketName;
const QUEUE_NAME = Aws.ingestionQueueUrl.split('/').pop()!;
const MOCK_S3_KEY = 'tariffs/year=2025/month=01/day=01/country=DE/party=EMS/tariff_id=KKK/PUT_20250101T000000000Z.json';

const endpoint = process.env.MINISTACK_ENDPOINT!;
const clientConfig = { region: Aws.region, endpoint };
const s3Client = new S3Client({ ...clientConfig, forcePathStyle: true });
const sqsClient = new SQSClient(clientConfig);

function buildSqsRecord(ingestionEvent: IngestionEvent, messageId = 'msg-001'): SQSRecord {
  return {
    messageId,
    receiptHandle: 'receipt-handle',
    body: JSON.stringify(ingestionEvent),
    attributes: {
      ApproximateReceiveCount: '1',
      SentTimestamp: '1735689600000',
      SenderId: 'SENDER',
      ApproximateFirstReceiveTimestamp: '1735689600000',
    },
    messageAttributes: {},
    md5OfBody: '',
    eventSource: 'aws:sqs',
    eventSourceARN: `arn:aws:sqs:${Aws.region}:000000000000:${QUEUE_NAME}`,
    awsRegion: Aws.region,
  };
}

function buildSqsEvent(records: SQSRecord[]): SQSEvent {
  return { Records: records };
}

async function readUploadedJsonLinesGzipRecord(): Promise<Record<string, unknown>[]> {
  const listedObjects = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: LANDING_ZONE_BUCKET_NAME,
        Prefix: 'ocpi-raw/',
      }),
  );

  expect(listedObjects.Contents).toHaveLength(1);

  const key = listedObjects.Contents![0].Key!;

  const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: LANDING_ZONE_BUCKET_NAME,
        Key: key,
      }),
  );

  const compressedBody = await response.Body!.transformToByteArray();
  const jsonLines = gunzipSync(Buffer.from(compressedBody)).toString('utf-8');

  return jsonLines
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe('raw-data-loader integration', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(async () => {
    await fetch(`${process.env.MINISTACK_ENDPOINT}/_ministack/reset`, { method: 'POST' });
    await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
    await s3Client.send(new CreateBucketCommand({ Bucket: LANDING_ZONE_BUCKET_NAME }));
    await sqsClient.send(new CreateQueueCommand({ QueueName: QUEUE_NAME }));
    consoleSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('PUT record: fetches S3 object and writes enriched RawDataRecord to JSONL.GZ batch', async () => {
    await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: MOCK_S3_KEY,
          Body: JSON.stringify(VALID_TARIFF),
          ContentType: 'application/json',
        }),
    );

    const ingestionEvent: IngestionEvent = {
      action: 'PUT',
      type: 'tariffs',
      object_id: TARIFF_ID,
      country_code: 'DE',
      party_id: 'EMS',
      ocpi_version: '2.2.1',
      received_at: '2025-01-01T00:00:00.000Z',
      raw: { bucket: BUCKET_NAME, key: MOCK_S3_KEY },
      delta: null,
    };

    const result = await handler(
        buildSqsEvent([buildSqsRecord(ingestionEvent)]),
        {} as never,
        () => {},
    );

    expect(result?.batchItemFailures).toHaveLength(0);

    const uploadedRecords = await readUploadedJsonLinesGzipRecord();

    expect(uploadedRecords).toHaveLength(1);
    expect(uploadedRecords[0].action).toBe('PUT');
    expect(uploadedRecords[0].payload).toEqual(VALID_TARIFF);
    expect(uploadedRecords[0].delta).toBeNull();
    expect(uploadedRecords[0].object_id).toBe(TARIFF_ID);
  });

  it('PATCH record: writes enriched RawDataRecord with delta and null payload to JSONL.GZ batch', async () => {
    const delta = { last_updated: '2025-06-01T00:00:00Z', currency: 'EUR' };

    const ingestionEvent: IngestionEvent = {
      action: 'PATCH',
      type: 'tariffs',
      object_id: TARIFF_ID,
      country_code: 'DE',
      party_id: 'EMS',
      ocpi_version: '2.2.1',
      received_at: '2025-01-01T00:00:00.000Z',
      raw: null,
      delta,
    };

    const result = await handler(
        buildSqsEvent([buildSqsRecord(ingestionEvent)]),
        {} as never,
        () => {},
    );

    expect(result?.batchItemFailures).toHaveLength(0);

    const uploadedRecords = await readUploadedJsonLinesGzipRecord();

    expect(uploadedRecords).toHaveLength(1);
    expect(uploadedRecords[0].action).toBe('PATCH');
    expect(uploadedRecords[0].payload).toBeNull();
    expect(uploadedRecords[0].delta).toEqual(delta);
  });

  it('DELETE record: writes enriched RawDataRecord with null payload and null delta to JSONL.GZ batch', async () => {
    const ingestionEvent: IngestionEvent = {
      action: 'DELETE',
      type: 'tariffs',
      object_id: TARIFF_ID,
      country_code: 'DE',
      party_id: 'EMS',
      ocpi_version: '2.2.1',
      received_at: '2025-01-01T00:00:00.000Z',
      raw: null,
      delta: null,
    };

    const result = await handler(
        buildSqsEvent([buildSqsRecord(ingestionEvent)]),
        {} as never,
        () => {},
    );

    expect(result?.batchItemFailures).toHaveLength(0);

    const uploadedRecords = await readUploadedJsonLinesGzipRecord();

    expect(uploadedRecords).toHaveLength(1);
    expect(uploadedRecords[0].action).toBe('DELETE');
    expect(uploadedRecords[0].payload).toBeNull();
    expect(uploadedRecords[0].delta).toBeNull();
  });

  it('writes multiple successful SQS records into one JSONL.GZ batch file', async () => {
    await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: MOCK_S3_KEY,
          Body: JSON.stringify(VALID_TARIFF),
          ContentType: 'application/json',
        }),
    );

    const putEvent: IngestionEvent = {
      action: 'PUT',
      type: 'tariffs',
      object_id: TARIFF_ID,
      country_code: 'DE',
      party_id: 'EMS',
      ocpi_version: '2.2.1',
      received_at: '2025-01-01T00:00:00.000Z',
      raw: { bucket: BUCKET_NAME, key: MOCK_S3_KEY },
      delta: null,
    };

    const patchEvent: IngestionEvent = {
      action: 'PATCH',
      type: 'tariffs',
      object_id: TARIFF_ID,
      country_code: 'DE',
      party_id: 'EMS',
      ocpi_version: '2.2.1',
      received_at: '2025-01-01T00:00:00.000Z',
      raw: null,
      delta: { currency: 'EUR' },
    };

    const result = await handler(
        buildSqsEvent([
          buildSqsRecord(putEvent, 'msg-1'),
          buildSqsRecord(patchEvent, 'msg-2'),
        ]),
        {} as never,
        () => {},
    );

    expect(result?.batchItemFailures).toHaveLength(0);

    const uploadedRecords = await readUploadedJsonLinesGzipRecord();

    expect(uploadedRecords).toHaveLength(2);
    expect(uploadedRecords[0].action).toBe('PUT');
    expect(uploadedRecords[1].action).toBe('PATCH');
  });

  it('S3 fetch failure: returns message in batchItemFailures', async () => {
    const ingestionEvent: IngestionEvent = {
      action: 'PUT',
      type: 'tariffs',
      object_id: TARIFF_ID,
      country_code: 'DE',
      party_id: 'EMS',
      ocpi_version: '2.2.1',
      received_at: '2025-01-01T00:00:00.000Z',
      raw: { bucket: BUCKET_NAME, key: 'tariffs/does-not-exist.json' },
      delta: null,
    };

    const result = await handler(
      buildSqsEvent([buildSqsRecord(ingestionEvent, 'msg-fail')]),
      {} as never,
      () => {},
    );

    expect(result?.batchItemFailures).toEqual([{ itemIdentifier: 'msg-fail' }]);
  });
});
