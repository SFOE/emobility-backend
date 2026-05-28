jest.mock('../../../../../../src/common/aws/s3');
jest.mock('../../../../../../src/common/aws/sqs');

import { APIGatewayProxyResult } from 'aws-lambda';
import { handler } from '../../../../../../src/functions/api/ocpi/tariffs/ocpi-tariffs-put';
import { putRawToS3 } from '/opt/nodejs/aws/s3';
import { publishIngestionEvent } from '/opt/nodejs/aws/sqs';
import { Aws } from '/opt/nodejs/aws/constants';
import { buildEvent } from '../../../../../shared/fixtures/ocpi-tariffs.fixture';
import { VALID_TARIFF, TARIFF_ID } from '../../../../../shared/test-data/ocpi-tariffs.data';

const mockPutRawToS3 = putRawToS3 as jest.MockedFunction<typeof putRawToS3>;
const mockPublishIngestionEvent = publishIngestionEvent as jest.MockedFunction<typeof publishIngestionEvent>;

const MOCK_S3_KEY = 'tariffs/year=2025/month=01/day=01/country=DE/party=EMS/tariff_id=KKK/PUT_20250101T000000000Z.json';

function parseBody(result: APIGatewayProxyResult) {
    return JSON.parse(result.body);
}

describe('ocpi-tariffs-put handler', () => {
    beforeEach(() => {
        jest.resetAllMocks();

        mockPutRawToS3.mockResolvedValue(MOCK_S3_KEY);
        mockPublishIngestionEvent.mockResolvedValue(undefined);
    });

    describe('happy path', () => {
        it('returns 200 with OCPI status 1000', async () => {
            const result = await handler(buildEvent());

            expect(result.statusCode).toBe(200);
            expect(parseBody(result).status_code).toBe(1000);
        });

        it('returns null data per OCPI spec', async () => {
            const result = await handler(buildEvent());

            expect(parseBody(result).data).toBeNull();
        });

        it('writes the tariff to S3 with correct type, action, and identifiers', async () => {
            await handler(buildEvent());

            expect(mockPutRawToS3).toHaveBeenCalledWith(
                VALID_TARIFF,
                'tariffs',
                'PUT',
                VALID_TARIFF.country_code,
                VALID_TARIFF.party_id,
                [`tariff_id=${TARIFF_ID}`],
                expect.any(String),
            );
        });

        it('publishes a PUT ingestion event to SQS with S3 reference', async () => {
            await handler(buildEvent());

            expect(mockPublishIngestionEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'PUT',
                    type: 'tariffs',
                    object_id: TARIFF_ID,
                    country_code: VALID_TARIFF.country_code,
                    party_id: VALID_TARIFF.party_id,
                    raw: {
                        bucket: Aws.rawDataBucketName,
                        key: MOCK_S3_KEY,
                    },
                    delta: null,
                }),
            );
        });

        it('publishes the SQS event after writing to S3', async () => {
            await handler(buildEvent());

            const s3CallOrder = mockPutRawToS3.mock.invocationCallOrder[0];
            const sqsCallOrder = mockPublishIngestionEvent.mock.invocationCallOrder[0];

            expect(s3CallOrder).toBeLessThan(sqsCallOrder);
        });
    });

    describe('S3 failure', () => {
        it('returns 500 when S3 write fails', async () => {
            mockPutRawToS3.mockRejectedValue(new Error('S3 unavailable'));

            const result = await handler(buildEvent());

            expect(result.statusCode).toBe(500);
        });

        it('does not publish to SQS when S3 write fails', async () => {
            mockPutRawToS3.mockRejectedValue(new Error('S3 unavailable'));

            await handler(buildEvent());

            expect(mockPublishIngestionEvent).not.toHaveBeenCalled();
        });
    });

    describe('SQS failure', () => {
        it('returns 500 when SQS publish fails', async () => {
            mockPublishIngestionEvent.mockRejectedValue(new Error('SQS unavailable'));

            const result = await handler(buildEvent());

            expect(result.statusCode).toBe(500);
        });

        it('has already written to S3 before the SQS failure', async () => {
            mockPublishIngestionEvent.mockRejectedValue(new Error('SQS unavailable'));

            await handler(buildEvent());

            expect(mockPutRawToS3).toHaveBeenCalled();
        });
    });
});
