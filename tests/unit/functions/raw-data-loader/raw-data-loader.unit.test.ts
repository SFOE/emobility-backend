jest.mock('/opt/nodejs/aws/s3');

import { SQSEvent, SQSRecord } from 'aws-lambda';
import { handler } from '../../../../src/functions/raw-data-loader/ocpi-raw-data-loader';
import {
  getRawFromS3,
  putJsonLinesGzipToS3,
  buildLandingZoneKey,
  createCrossAccountS3Client,
} from '/opt/nodejs/aws/s3';
import { IngestionEvent } from '/opt/nodejs/aws/sqs';
import {
  VALID_TARIFF,
  TARIFF_ID,
} from '../../../shared/test-data/ocpi-tariffs.data';

const mockPutJsonLinesGzipToS3 = putJsonLinesGzipToS3 as jest.MockedFunction<
  typeof putJsonLinesGzipToS3
>;
const mockGetRawFromS3 = getRawFromS3 as jest.MockedFunction<
  typeof getRawFromS3
>;
const mockBuildLandingZoneKey = buildLandingZoneKey as jest.MockedFunction<
  typeof buildLandingZoneKey
>;
const mockCreateCrossAccountS3Client =
  createCrossAccountS3Client as jest.MockedFunction<
    typeof createCrossAccountS3Client
  >;

const MOCK_BUCKET = 'emobility-test-ocpi-rawdata-bucket';
const MOCK_S3_KEY =
  'tariffs/year=2025/month=01/day=01/country=DE/party=EMS/tariff_id=KKK/PUT_20250101T000000000Z.json';
const MOCK_PATCH_S3_KEY =
  'tariffs/year=2025/month=01/day=01/country=DE/party=EMS/tariff_id=KKK/PATCH_20250101T000000000Z.json';

const PUT_EVENT: IngestionEvent = {
  action: 'PUT',
  type: 'tariffs',
  object_id: TARIFF_ID,
  country_code: 'DE',
  party_id: 'EMS',
  ocpi_version: '2.2.1',
  received_at: '2025-01-01T00:00:00.000Z',
  raw: { bucket: MOCK_BUCKET, key: MOCK_S3_KEY },
};

const MOCK_PATCH_PAYLOAD = {
  last_updated: '2025-06-01T00:00:00Z',
  currency: 'EUR',
};

const PATCH_EVENT: IngestionEvent = {
  action: 'PATCH',
  type: 'tariffs',
  object_id: TARIFF_ID,
  country_code: 'DE',
  party_id: 'EMS',
  ocpi_version: '2.2.1',
  received_at: '2025-01-01T00:00:00.000Z',
  raw: { bucket: MOCK_BUCKET, key: MOCK_PATCH_S3_KEY },
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
};

function buildSqsRecord(
  ingestionEvent: IngestionEvent,
  messageId = 'msg-001',
): SQSRecord {
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

function getUploadedRecords(): Record<string, unknown>[] {
  const [, , records] = mockPutJsonLinesGzipToS3.mock.calls[0];

  return records as Record<string, unknown>[];
}

describe('raw-data-loader handler', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetAllMocks();
    mockPutJsonLinesGzipToS3.mockResolvedValue(undefined);
    mockGetRawFromS3.mockResolvedValue(VALID_TARIFF);
    mockBuildLandingZoneKey.mockReturnValue(
      'ocpi-raw/year=2025/month=01/day=01/2025-01-01T000000000Z-req.jsonl.gz',
    );
    consoleSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('PUT record', () => {
    it('fetches raw payload from S3 using bucket and key from the event', async () => {
      await handler(
        buildSqsEvent([buildSqsRecord(PUT_EVENT)]),
        {} as never,
        () => {},
      );

      expect(mockGetRawFromS3).toHaveBeenCalledWith(MOCK_BUCKET, MOCK_S3_KEY);
    });

    it('returns empty batchItemFailures on success', async () => {
      const result = await handler(
        buildSqsEvent([buildSqsRecord(PUT_EVENT)]),
        {} as never,
        () => {},
      );

      expect(result?.batchItemFailures).toHaveLength(0);
    });

    it('uploads a batch record with the S3 payload', async () => {
      await handler(
        buildSqsEvent([buildSqsRecord(PUT_EVENT)]),
        {} as never,
        () => {},
      );

      const uploadedRecords = getUploadedRecords();

      expect(uploadedRecords).toHaveLength(1);
      expect(uploadedRecords[0].payload).toEqual(VALID_TARIFF);
      expect(uploadedRecords[0].action).toBe('PUT');
    });
  });

  describe('PATCH record', () => {
    it('fetches raw payload from S3 using bucket and key from the event', async () => {
      mockGetRawFromS3.mockResolvedValue(MOCK_PATCH_PAYLOAD);

      await handler(
        buildSqsEvent([buildSqsRecord(PATCH_EVENT)]),
        {} as never,
        () => {},
      );

      expect(mockGetRawFromS3).toHaveBeenCalledWith(
        MOCK_BUCKET,
        MOCK_PATCH_S3_KEY,
      );
    });

    it('returns empty batchItemFailures', async () => {
      const result = await handler(
        buildSqsEvent([buildSqsRecord(PATCH_EVENT)]),
        {} as never,
        () => {},
      );

      expect(result?.batchItemFailures).toHaveLength(0);
    });

    it('uploads a batch record with the S3 payload', async () => {
      mockGetRawFromS3.mockResolvedValue(MOCK_PATCH_PAYLOAD);

      await handler(
        buildSqsEvent([buildSqsRecord(PATCH_EVENT)]),
        {} as never,
        () => {},
      );

      const uploadedRecords = getUploadedRecords();

      expect(uploadedRecords).toHaveLength(1);
      expect(uploadedRecords[0].payload).toEqual(MOCK_PATCH_PAYLOAD);
      expect(uploadedRecords[0].action).toBe('PATCH');
    });
  });

  describe('DELETE record', () => {
    it('does NOT call getRawFromS3', async () => {
      await handler(
        buildSqsEvent([buildSqsRecord(DELETE_EVENT)]),
        {} as never,
        () => {},
      );

      expect(mockGetRawFromS3).not.toHaveBeenCalled();
    });

    it('returns empty batchItemFailures', async () => {
      const result = await handler(
        buildSqsEvent([buildSqsRecord(DELETE_EVENT)]),
        {} as never,
        () => {},
      );

      expect(result?.batchItemFailures).toHaveLength(0);
    });

    it('uploads a batch record with null payload', async () => {
      await handler(
        buildSqsEvent([buildSqsRecord(DELETE_EVENT)]),
        {} as never,
        () => {},
      );

      const uploadedRecords = getUploadedRecords();

      expect(uploadedRecords).toHaveLength(1);
      expect(uploadedRecords[0].payload).toBeNull();
      expect(uploadedRecords[0].action).toBe('DELETE');
    });
  });

  describe('S3 failure on PUT record', () => {
    it('adds the message id to batchItemFailures', async () => {
      mockGetRawFromS3.mockRejectedValue(new Error('S3 unavailable'));

      const result = await handler(
        buildSqsEvent([buildSqsRecord(PUT_EVENT, 'msg-fail')]),
        {} as never,
        () => {},
      );

      expect(result?.batchItemFailures).toEqual([
        { itemIdentifier: 'msg-fail' },
      ]);
    });

    it('does not throw', async () => {
      mockGetRawFromS3.mockRejectedValue(new Error('S3 unavailable'));

      await expect(
        handler(
          buildSqsEvent([buildSqsRecord(PUT_EVENT)]),
          {} as never,
          () => {},
        ),
      ).resolves.not.toThrow();
    });

    it('still processes other records in the same batch', async () => {
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

      expect(result?.batchItemFailures).toEqual([
        { itemIdentifier: 'msg-fail' },
      ]);
    });
  });

  describe('batch with multiple records', () => {
    it('returns empty batchItemFailures when all records succeed', async () => {
      const result = await handler(
        buildSqsEvent([
          buildSqsRecord(PUT_EVENT, 'msg-1'),
          buildSqsRecord(PATCH_EVENT, 'msg-2'),
        ]),
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

      expect(result?.batchItemFailures).toEqual([
        { itemIdentifier: 'msg-fail' },
      ]);
    });

    it('writes all records of a batch into one file regardless of module type', async () => {
      const locationsPutEvent: IngestionEvent = {
        ...PUT_EVENT,
        type: 'locations',
      };

      await handler(
        buildSqsEvent([
          buildSqsRecord(PUT_EVENT, 'msg-1'), // type=tariffs
          buildSqsRecord(locationsPutEvent, 'msg-2'), // type=locations
          buildSqsRecord(PATCH_EVENT, 'msg-3'), // type=tariffs, action=PATCH
        ]),
        {} as never,
        () => {},
      );

      const uploadedRecords = getUploadedRecords();

      expect(mockPutJsonLinesGzipToS3).toHaveBeenCalledTimes(1);
      expect(uploadedRecords).toHaveLength(3);
    });

    it('marks all successfully processed records as failed when the batch upload fails', async () => {
      mockPutJsonLinesGzipToS3.mockRejectedValueOnce(
        new Error('Landing Zone upload failed'),
      );

      const result = await handler(
        buildSqsEvent([
          buildSqsRecord(PUT_EVENT, 'msg-1'),
          buildSqsRecord(PATCH_EVENT, 'msg-2'),
        ]),
        {} as never,
        () => {},
      );

      expect(result).toEqual({
        batchItemFailures: [
          { itemIdentifier: 'msg-1' },
          { itemIdentifier: 'msg-2' },
        ],
      });
    });
  });

  describe('Landing Zone key uniqueness (#1)', () => {
    it('builds the batch key with the invocation awsRequestId', async () => {
      await handler(
        buildSqsEvent([buildSqsRecord(PUT_EVENT)]),
        { awsRequestId: 'req-abc-123' } as never,
        () => {},
      );

      expect(mockBuildLandingZoneKey).toHaveBeenCalledWith(
        expect.any(Date),
        'req-abc-123',
      );
    });
  });

  describe('cross-account role failure (#5)', () => {
    it('retries all messages and does not throw when AssumeRole fails', async () => {
      mockCreateCrossAccountS3Client.mockRejectedValue(
        new Error('STS throttled'),
      );

      const result = await handler(
        buildSqsEvent([
          buildSqsRecord(PUT_EVENT, 'msg-1'),
          buildSqsRecord(PATCH_EVENT, 'msg-2'),
        ]),
        {} as never,
        () => {},
      );

      expect(result).toEqual({
        batchItemFailures: [
          { itemIdentifier: 'msg-1' },
          { itemIdentifier: 'msg-2' },
        ],
      });
      // The batch write is never attempted when the role cannot be assumed.
      expect(mockPutJsonLinesGzipToS3).not.toHaveBeenCalled();
    });
  });

  describe('event without a raw field (#6)', () => {
    it('treats it as no-payload: no S3 fetch, no crash, null payload', async () => {
      const eventWithoutRaw = JSON.parse(JSON.stringify(PUT_EVENT));
      delete eventWithoutRaw.raw;

      const result = await handler(
        buildSqsEvent([buildSqsRecord(eventWithoutRaw, 'msg-noraw')]),
        {} as never,
        () => {},
      );

      expect(result?.batchItemFailures).toHaveLength(0);
      expect(mockGetRawFromS3).not.toHaveBeenCalled();

      const uploadedRecords = getUploadedRecords();
      expect(uploadedRecords).toHaveLength(1);
      expect(uploadedRecords[0].payload).toBeNull();
    });
  });
});
