jest.mock('../../../../../../src/common/aws/s3');
jest.mock('../../../../../../src/common/aws/sqs');

import { APIGatewayProxyResult } from 'aws-lambda';
import { handler } from '../../../../../../src/functions/api/ocpi/locations/ocpi-locations-put-connector';
import { putRawToS3 } from '/opt/nodejs/aws/s3';
import { publishIngestionEvent } from '/opt/nodejs/aws/sqs';
import { Aws } from '/opt/nodejs/aws/constants';
import { buildConnectorPutEvent } from '../../../../../shared/fixtures/ocpi-locations.fixture';
import { CONNECTOR_ID, EVSE_UID, LOCATION_ID, VALID_CONNECTOR, VALID_LOCATION } from '../../../../../shared/test-data/ocpi-locations.data';

const mockPutRawToS3 = putRawToS3 as jest.MockedFunction<typeof putRawToS3>;
const mockPublishIngestionEvent = publishIngestionEvent as jest.MockedFunction<typeof publishIngestionEvent>;

const MOCK_S3_KEY = 'connector/year=2025/month=01/day=01/country=DE/party=EMS/location_id=LOC001/evse_uid=EVSE001/connector_id=1/PUT_20250101T000000000Z.json';

function parseBody(result: APIGatewayProxyResult) {
    return JSON.parse(result.body);
}

describe('ocpi-locations-put-connector handler', () => {
    beforeEach(() => {
        jest.resetAllMocks();

        mockPutRawToS3.mockResolvedValue(MOCK_S3_KEY);
        mockPublishIngestionEvent.mockResolvedValue(undefined);
    });

    describe('connector id validation', () => {
        it('returns 400 with OCPI 2001 when connector id in body does not match path', async () => {
            const result = await handler(
                buildConnectorPutEvent({
                    body: JSON.stringify({ ...VALID_CONNECTOR, id: 'DIFFERENT_ID' }),
                }),
            );

            expect(result.statusCode).toBe(400);
            expect(parseBody(result).status_code).toBe(2001);
        });

        it('does not write to S3 or SQS when connector id does not match', async () => {
            await handler(
                buildConnectorPutEvent({
                    body: JSON.stringify({ ...VALID_CONNECTOR, id: 'DIFFERENT_ID' }),
                }),
            );

            expect(mockPutRawToS3).not.toHaveBeenCalled();
            expect(mockPublishIngestionEvent).not.toHaveBeenCalled();
        });
    });

    describe('happy path', () => {
        it('returns 200 with OCPI status 1000', async () => {
            const result = await handler(buildConnectorPutEvent());

            expect(result.statusCode).toBe(200);
            expect(parseBody(result).status_code).toBe(1000);
        });

        it('returns null data per OCPI spec', async () => {
            const result = await handler(buildConnectorPutEvent());

            expect(parseBody(result).data).toBeNull();
        });

        it('writes the connector to S3 with correct type, action, and composite partitions', async () => {
            await handler(buildConnectorPutEvent());

            expect(mockPutRawToS3).toHaveBeenCalledWith(
                VALID_CONNECTOR,
                'connector',
                'PUT',
                VALID_LOCATION.country_code,
                VALID_LOCATION.party_id,
                [`location_id=${LOCATION_ID}`, `evse_uid=${EVSE_UID}`, `connector_id=${CONNECTOR_ID}`],
                expect.any(String),
            );
        });

        it('publishes a PUT ingestion event to SQS with composite object_id and S3 reference', async () => {
            await handler(buildConnectorPutEvent());

            expect(mockPublishIngestionEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'PUT',
                    type: 'connector',
                    object_id: `${LOCATION_ID}*${EVSE_UID}*${CONNECTOR_ID}`,
                    country_code: VALID_LOCATION.country_code,
                    party_id: VALID_LOCATION.party_id,
                    raw: {
                        bucket: Aws.rawDataBucketName,
                        key: MOCK_S3_KEY,
                    },
                }),
            );
        });

        it('publishes the SQS event after writing to S3', async () => {
            await handler(buildConnectorPutEvent());

            const s3CallOrder = mockPutRawToS3.mock.invocationCallOrder[0];
            const sqsCallOrder = mockPublishIngestionEvent.mock.invocationCallOrder[0];

            expect(s3CallOrder).toBeLessThan(sqsCallOrder);
        });
    });

    describe('S3 failure', () => {
        it('returns 500 when S3 write fails', async () => {
            mockPutRawToS3.mockRejectedValue(new Error('S3 unavailable'));

            const result = await handler(buildConnectorPutEvent());

            expect(result.statusCode).toBe(500);
        });

        it('does not publish to SQS when S3 write fails', async () => {
            mockPutRawToS3.mockRejectedValue(new Error('S3 unavailable'));

            await handler(buildConnectorPutEvent());

            expect(mockPublishIngestionEvent).not.toHaveBeenCalled();
        });
    });

    describe('SQS failure', () => {
        it('returns 500 when SQS publish fails', async () => {
            mockPublishIngestionEvent.mockRejectedValue(new Error('SQS unavailable'));

            const result = await handler(buildConnectorPutEvent());

            expect(result.statusCode).toBe(500);
        });

        it('has already written to S3 before the SQS failure', async () => {
            mockPublishIngestionEvent.mockRejectedValue(new Error('SQS unavailable'));

            await handler(buildConnectorPutEvent());

            expect(mockPutRawToS3).toHaveBeenCalled();
        });
    });
});
