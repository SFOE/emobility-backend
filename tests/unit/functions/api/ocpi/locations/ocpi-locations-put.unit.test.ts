jest.mock('../../../../../../src/common/aws/s3');
jest.mock('../../../../../../src/common/aws/sqs');

import { APIGatewayProxyResult } from 'aws-lambda';
import { handler } from '../../../../../../src/functions/api/ocpi/locations/ocpi-locations-put';
import { putRawToS3 } from '../../../../../../src/common/aws/s3';
import { publishIngestionEvent } from '../../../../../../src/common/aws/sqs';
import { Aws } from '../../../../../../src/common/aws/constants';
import { buildLocationPutEvent } from '../../../../../shared/fixtures/ocpi-locations.fixture';
import { LOCATION_ID, VALID_LOCATION } from '../../../../../shared/test-data/ocpi-locations.data';

const mockPutRawToS3 = putRawToS3 as jest.MockedFunction<typeof putRawToS3>;
const mockPublishIngestionEvent = publishIngestionEvent as jest.MockedFunction<typeof publishIngestionEvent>;

const MOCK_S3_KEY = 'locations/year=2025/month=01/day=01/country=DE/party=EMS/location_id=LOC001/PUT_20250101T000000000Z.json';

function parseBody(result: APIGatewayProxyResult) {
    return JSON.parse(result.body);
}

describe('ocpi-locations-put handler', () => {
    beforeEach(() => {
        jest.resetAllMocks();

        mockPutRawToS3.mockResolvedValue(MOCK_S3_KEY);
        mockPublishIngestionEvent.mockResolvedValue(undefined);
    });

    describe('happy path', () => {
        it('returns 200 with OCPI status 1000', async () => {
            const result = await handler(buildLocationPutEvent());

            expect(result.statusCode).toBe(200);
            expect(parseBody(result).status_code).toBe(1000);
        });

        it('returns null data per OCPI spec', async () => {
            const result = await handler(buildLocationPutEvent());

            expect(parseBody(result).data).toBeNull();
        });

        it('writes the location to S3 with correct type, action, and identifiers', async () => {
            await handler(buildLocationPutEvent());

            expect(mockPutRawToS3).toHaveBeenCalledWith(
                VALID_LOCATION,
                'locations',
                'PUT',
                VALID_LOCATION.country_code,
                VALID_LOCATION.party_id,
                [`location_id=${LOCATION_ID}`],
                expect.any(String),
            );
        });

        it('publishes a PUT ingestion event to SQS with S3 reference', async () => {
            await handler(buildLocationPutEvent());

            expect(mockPublishIngestionEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'PUT',
                    type: 'locations',
                    object_id: LOCATION_ID,
                    country_code: VALID_LOCATION.country_code,
                    party_id: VALID_LOCATION.party_id,
                    raw: {
                        bucket: Aws.rawDataBucketName,
                        key: MOCK_S3_KEY,
                    },
                    delta: null,
                }),
            );
        });

        it('publishes the SQS event after writing to S3', async () => {
            await handler(buildLocationPutEvent());

            const s3CallOrder = mockPutRawToS3.mock.invocationCallOrder[0];
            const sqsCallOrder = mockPublishIngestionEvent.mock.invocationCallOrder[0];

            expect(s3CallOrder).toBeLessThan(sqsCallOrder);
        });
    });

    describe('S3 failure', () => {
        it('returns 500 when S3 write fails', async () => {
            mockPutRawToS3.mockRejectedValue(new Error('S3 unavailable'));

            const result = await handler(buildLocationPutEvent());

            expect(result.statusCode).toBe(500);
        });

        it('does not publish to SQS when S3 write fails', async () => {
            mockPutRawToS3.mockRejectedValue(new Error('S3 unavailable'));

            await handler(buildLocationPutEvent());

            expect(mockPublishIngestionEvent).not.toHaveBeenCalled();
        });
    });

    describe('SQS failure', () => {
        it('returns 500 when SQS publish fails', async () => {
            mockPublishIngestionEvent.mockRejectedValue(new Error('SQS unavailable'));

            const result = await handler(buildLocationPutEvent());

            expect(result.statusCode).toBe(500);
        });

        it('has already written to S3 before the SQS failure', async () => {
            mockPublishIngestionEvent.mockRejectedValue(new Error('SQS unavailable'));

            await handler(buildLocationPutEvent());

            expect(mockPutRawToS3).toHaveBeenCalled();
        });
    });
});
