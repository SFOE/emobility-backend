jest.mock('../../../../../../src/common/aws/s3');

import { SQSEvent, SQSRecord } from 'aws-lambda';
import { handler } from '../../../../../../src/functions/api/ocpi/raw-data-loader/ocpi-raw-data-loader';
import { getRawFromS3 } from '../../../../../../src/common/aws/s3';
import { IngestionEvent } from '../../../../../../src/common/aws/sqs';
import { VALID_TARIFF, TARIFF_ID } from '../../../../../shared/test-data/ocpi-tariffs.data';

const mockGetRawFromS3 = getRawFromS3 as jest.MockedFunction<typeof getRawFromS3>;

const MOCK_BUCKET = 'emobility-test-ocpi-rawdata-bucket';
const MOCK_S3_KEY = 'tariffs/year=2025/month=01/day=01/country=DE/party=EMS/tariff_id=KKK/PUT_20250101T000000000Z.json';

const PUT_EVENT: IngestionEvent = {
  action: 'PUT',
  type: 'tariffs',
  object_id: TARIFF_ID,
  country_code: 'DE',
  party_id: 'EMS',
  ocpi_version: '2.2.1',
  received_at: '2025-01-01T00:00:00.000Z',
  raw: { bucket: MOCK_BUCKET, key: MOCK_S3_KEY },
  delta: null,
};

const PATCH_EVENT: IngestionEvent = {
  action: 'PATCH',
  type: 'tariffs',
  object_id: TARIFF_ID,
  country_code: 'DE',
  party_id: 'EMS',
  ocpi_version: '2.2.1',
  received_at: '2025-01-01T00:00:00.000Z',
  raw: null,
  delta: { last_updated: '2025-06-01T00:00:00Z', currency: 'EUR' },
};

const DELETE_EVENT: IngestionEvent = {
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
    eventSourceARN: 'arn:aws:sqs:eu-central-1:000000000000:test-queue',
    awsRegion: 'eu-central-1',
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

describe('raw-data-loader handler', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetAllMocks();
    mockGetRawFromS3.mockResolvedValue(VALID_TARIFF);
    consoleSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('PUT record', () => {
    it('fetches raw payload from S3 using bucket and key from the event', async () => {
      await handler(buildSqsEvent([buildSqsRecord(PUT_EVENT)]), {} as never, () => {});

      expect(mockGetRawFromS3).toHaveBeenCalledWith(MOCK_BUCKET, MOCK_S3_KEY);
    });

    it('returns empty batchItemFailures on success', async () => {
      const result = await handler(buildSqsEvent([buildSqsRecord(PUT_EVENT)]), {} as never, () => {});

      expect(result?.batchItemFailures).toHaveLength(0);
    });

    it('logs a record with the S3 payload and null delta', async () => {
      await handler(buildSqsEvent([buildSqsRecord(PUT_EVENT)]), {} as never, () => {});

      const logged = getLoggedRecord(consoleSpy);
      expect(logged.payload).toEqual(VALID_TARIFF);
      expect(logged.delta).toBeNull();
      expect(logged.action).toBe('PUT');
    });
  });

  describe('PATCH record', () => {
    it('does NOT call getRawFromS3', async () => {
      await handler(buildSqsEvent([buildSqsRecord(PATCH_EVENT)]), {} as never, () => {});

      expect(mockGetRawFromS3).not.toHaveBeenCalled();
    });

    it('returns empty batchItemFailures', async () => {
      const result = await handler(buildSqsEvent([buildSqsRecord(PATCH_EVENT)]), {} as never, () => {});

      expect(result?.batchItemFailures).toHaveLength(0);
    });

    it('logs a record with null payload and the event delta', async () => {
      await handler(buildSqsEvent([buildSqsRecord(PATCH_EVENT)]), {} as never, () => {});

      const logged = getLoggedRecord(consoleSpy);
      expect(logged.payload).toBeNull();
      expect(logged.delta).toEqual(PATCH_EVENT.delta);
      expect(logged.action).toBe('PATCH');
    });
  });

  describe('DELETE record', () => {
    it('does NOT call getRawFromS3', async () => {
      await handler(buildSqsEvent([buildSqsRecord(DELETE_EVENT)]), {} as never, () => {});

      expect(mockGetRawFromS3).not.toHaveBeenCalled();
    });

    it('returns empty batchItemFailures', async () => {
      const result = await handler(buildSqsEvent([buildSqsRecord(DELETE_EVENT)]), {} as never, () => {});

      expect(result?.batchItemFailures).toHaveLength(0);
    });

    it('logs a record with null payload and null delta', async () => {
      await handler(buildSqsEvent([buildSqsRecord(DELETE_EVENT)]), {} as never, () => {});

      const logged = getLoggedRecord(consoleSpy);
      expect(logged.payload).toBeNull();
      expect(logged.delta).toBeNull();
      expect(logged.action).toBe('DELETE');
    });
  });

  describe('S3 failure on PUT record', () => {
    it('adds the message id to batchItemFailures', async () => {
      mockGetRawFromS3.mockRejectedValue(new Error('S3 unavailable'));

      const result = await handler(buildSqsEvent([buildSqsRecord(PUT_EVENT, 'msg-fail')]), {} as never, () => {});

      expect(result?.batchItemFailures).toEqual([{ itemIdentifier: 'msg-fail' }]);
    });

    it('does not throw', async () => {
      mockGetRawFromS3.mockRejectedValue(new Error('S3 unavailable'));

      await expect(
        handler(buildSqsEvent([buildSqsRecord(PUT_EVENT)]), {} as never, () => {}),
      ).resolves.not.toThrow();
    });

    it('still processes other records in the same batch', async () => {
      mockGetRawFromS3
        .mockRejectedValueOnce(new Error('S3 unavailable'))
        .mockResolvedValueOnce(VALID_TARIFF);

      const result = await handler(
        buildSqsEvent([buildSqsRecord(PUT_EVENT, 'msg-fail'), buildSqsRecord(PUT_EVENT, 'msg-ok')]),
        {} as never,
        () => {},
      );

      expect(result?.batchItemFailures).toEqual([{ itemIdentifier: 'msg-fail' }]);
    });
  });

  describe('batch with multiple records', () => {
    it('returns empty batchItemFailures when all records succeed', async () => {
      const result = await handler(
        buildSqsEvent([buildSqsRecord(PUT_EVENT, 'msg-1'), buildSqsRecord(PATCH_EVENT, 'msg-2')]),
        {} as never,
        () => {},
      );

      expect(result?.batchItemFailures).toHaveLength(0);
    });

    it('only failing record ids appear in batchItemFailures', async () => {
      mockGetRawFromS3
        .mockRejectedValueOnce(new Error('S3 unavailable'))
        .mockResolvedValueOnce(VALID_TARIFF);

      const result = await handler(
        buildSqsEvent([
          buildSqsRecord(PUT_EVENT, 'msg-fail'),
          buildSqsRecord(PUT_EVENT, 'msg-ok'),
        ]),
        {} as never,
        () => {},
      );

      expect(result?.batchItemFailures).toEqual([{ itemIdentifier: 'msg-fail' }]);
    });
  });
});
