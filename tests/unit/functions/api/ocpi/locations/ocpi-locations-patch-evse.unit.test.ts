jest.mock('../../../../../../src/common/aws/s3');
jest.mock('../../../../../../src/common/aws/sqs');
jest.mock(
  '../../../../../../src/common/modules/ocpi-locations/ocpi-locations.db',
);

import { APIGatewayProxyResult } from 'aws-lambda';
import { handler } from '../../../../../../src/functions/api/ocpi/locations/ocpi-locations-patch-evse';
import { putRawToS3 } from '/opt/nodejs/aws/s3';
import { publishIngestionEvent } from '/opt/nodejs/aws/sqs';
import { upsertEvseCurrentStatus } from '/opt/nodejs/modules/ocpi-locations/ocpi-locations.db';
import { Aws } from '/opt/nodejs/aws/constants';
import { buildEvsePatchEvent } from '../../../../../shared/fixtures/ocpi-locations.fixture';
import {
  EVSE_UID,
  LOCATION_ID,
  VALID_LOCATION,
} from '../../../../../shared/test-data/ocpi-locations.data';

const mockPutRawToS3 = putRawToS3 as jest.MockedFunction<typeof putRawToS3>;
const mockPublishIngestionEvent = publishIngestionEvent as jest.MockedFunction<
  typeof publishIngestionEvent
>;
const mockUpsertEvseCurrentStatus =
  upsertEvseCurrentStatus as jest.MockedFunction<
    typeof upsertEvseCurrentStatus
  >;

const MOCK_S3_KEY =
  'evse/year=2025/month=01/day=01/country=CH/party=EMS/location_id=LOC001/evse_uid=EVSE001/PATCH_20250101T000000000Z.json';

function parseBody(result: APIGatewayProxyResult) {
  return JSON.parse(result.body);
}

describe('ocpi-locations-patch-evse handler', () => {
  beforeEach(() => {
    jest.resetAllMocks();

    mockPutRawToS3.mockResolvedValue(MOCK_S3_KEY);
    mockPublishIngestionEvent.mockResolvedValue(undefined);
    mockUpsertEvseCurrentStatus.mockResolvedValue(true);
  });

  describe('last_updated validation', () => {
    it('returns 400 with OCPI 2001 when last_updated is missing from the patch body', async () => {
      const result = await handler(
        buildEvsePatchEvent({ body: JSON.stringify({ status: 'CHARGING' }) }),
      );

      expect(result.statusCode).toBe(400);
      expect(parseBody(result).status_code).toBe(2001);
    });

    it('returns 400 with OCPI 2001 when last_updated is an empty string', async () => {
      const result = await handler(
        buildEvsePatchEvent({ body: JSON.stringify({ last_updated: '' }) }),
      );

      expect(result.statusCode).toBe(400);
      expect(parseBody(result).status_code).toBe(2001);
    });

    it('does not publish to SQS when last_updated is missing', async () => {
      await handler(
        buildEvsePatchEvent({ body: JSON.stringify({ status: 'CHARGING' }) }),
      );

      expect(mockPublishIngestionEvent).not.toHaveBeenCalled();
    });
  });

  describe('happy path', () => {
    it('returns 200 with OCPI status 1000', async () => {
      const result = await handler(buildEvsePatchEvent());

      expect(result.statusCode).toBe(200);
      expect(parseBody(result).status_code).toBe(1000);
    });

    it('returns null data per OCPI spec', async () => {
      const result = await handler(buildEvsePatchEvent());

      expect(parseBody(result).data).toBeNull();
    });

    it('writes the patch body to S3 with correct type, action, and identifiers', async () => {
      await handler(buildEvsePatchEvent());

      expect(mockPutRawToS3).toHaveBeenCalledWith(
        expect.any(Object),
        'evse',
        'PATCH',
        VALID_LOCATION.country_code,
        VALID_LOCATION.party_id,
        [`location_id=${LOCATION_ID}`, `evse_uid=${EVSE_UID}`],
        expect.any(String),
      );
    });

    it('publishes a PATCH ingestion event to SQS with composite object_id and S3 reference', async () => {
      await handler(buildEvsePatchEvent());

      expect(mockPublishIngestionEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PATCH',
          type: 'evse',
          location_id: LOCATION_ID,
          evse_uid: EVSE_UID,
          country_code: VALID_LOCATION.country_code,
          party_id: VALID_LOCATION.party_id,
          raw: { bucket: Aws.rawDataBucketName, key: MOCK_S3_KEY },
        }),
      );
    });
  });

  describe('EVSE status fast-path validation', () => {
    it('writes the status to DynamoDB when it is a valid EVSE status', async () => {
      await handler(
        buildEvsePatchEvent({
          body: JSON.stringify({
            status: 'CHARGING',
            last_updated: '2026-01-01T00:00:00Z',
          }),
        }),
      );

      expect(mockUpsertEvseCurrentStatus).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'CHARGING' }),
      );
    });

    it('does NOT write to DynamoDB when the status is not a valid EVSE status', async () => {
      await handler(
        buildEvsePatchEvent({
          body: JSON.stringify({
            status: 'charging',
            last_updated: '2026-01-01T00:00:00Z',
          }),
        }),
      );

      expect(mockUpsertEvseCurrentStatus).not.toHaveBeenCalled();
    });
  });

  describe('S3 failure', () => {
    it('returns 500 when S3 write fails', async () => {
      mockPutRawToS3.mockRejectedValue(new Error('S3 unavailable'));

      const result = await handler(buildEvsePatchEvent());

      expect(result.statusCode).toBe(500);
    });
  });

  describe('SQS failure', () => {
    it('returns 500 when SQS publish fails', async () => {
      mockPublishIngestionEvent.mockRejectedValue(new Error('SQS unavailable'));

      const result = await handler(buildEvsePatchEvent());

      expect(result.statusCode).toBe(500);
    });
  });
});
