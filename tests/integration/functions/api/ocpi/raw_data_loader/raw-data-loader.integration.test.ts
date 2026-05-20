// globalSetup sets AWS_ENDPOINT_URL_* before workers spawn, so static SDK clients already point to Ministack.
import {
  CreateBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { CreateQueueCommand, SQSClient } from '@aws-sdk/client-sqs';
import { SQSEvent, SQSRecord } from 'aws-lambda';
import { handler } from '../../../../../../src/functions/api/ocpi/raw_data_loader/ocpi-raw-data-loader';
import { Aws } from '../../../../../../src/common/aws/constants';
import { IngestionEvent } from '../../../../../../src/common/aws/sqs';
import { VALID_TARIFF, TARIFF_ID } from '../../../../../shared/test-data/ocpi-tariffs.data';

const BUCKET_NAME = Aws.rawDataBucketName;
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

function getLoggedRecord(consoleSpy: jest.SpyInstance): Record<string, unknown> {
  const line = consoleSpy.mock.calls
    .map((c) => c[0] as string)
    .find((m) => m.includes('[raw-data-loader][record]'));
  return JSON.parse(line!.replace('[raw-data-loader][record] ', ''));
}

describe('raw-data-loader integration', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(async () => {
    await fetch(`${process.env.MINISTACK_ENDPOINT}/_ministack/reset`, { method: 'POST' });
    await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
    await sqsClient.send(new CreateQueueCommand({ QueueName: QUEUE_NAME }));
    consoleSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('PUT record: fetches S3 object and logs enriched RawDataRecord', async () => {
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

    const result = await handler(buildSqsEvent([buildSqsRecord(ingestionEvent)]), {} as never, () => {});

    expect(result?.batchItemFailures).toHaveLength(0);

    const logged = getLoggedRecord(consoleSpy);
    expect(logged.action).toBe('PUT');
    expect(logged.payload).toEqual(VALID_TARIFF);
    expect(logged.delta).toBeNull();
    expect(logged.object_id).toBe(TARIFF_ID);
  });

  it('PATCH record: logs enriched RawDataRecord with delta and null payload', async () => {
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

    const result = await handler(buildSqsEvent([buildSqsRecord(ingestionEvent)]), {} as never, () => {});

    expect(result?.batchItemFailures).toHaveLength(0);

    const logged = getLoggedRecord(consoleSpy);
    expect(logged.action).toBe('PATCH');
    expect(logged.payload).toBeNull();
    expect(logged.delta).toEqual(delta);
  });

  it('DELETE record: logs enriched RawDataRecord with null payload and null delta', async () => {
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

    const result = await handler(buildSqsEvent([buildSqsRecord(ingestionEvent)]), {} as never, () => {});

    expect(result?.batchItemFailures).toHaveLength(0);

    const logged = getLoggedRecord(consoleSpy);
    expect(logged.action).toBe('DELETE');
    expect(logged.payload).toBeNull();
    expect(logged.delta).toBeNull();
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
