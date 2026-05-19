jest.mock('../../../../../../src/common/aws/sqs');

import { APIGatewayProxyResult } from 'aws-lambda';
import { handler } from '../../../../../../src/functions/api/ocpi/tariffs/ocpi-tariffs-delete';
import { publishIngestionEvent } from '../../../../../../src/common/aws/sqs';
import { buildDeleteEvent } from '../../../../../shared/fixtures/ocpi-tariffs.fixture';
import { VALID_TARIFF, TARIFF_ID } from '../../../../../shared/test-data/ocpi-tariffs.data';

const mockPublishIngestionEvent = publishIngestionEvent as jest.MockedFunction<typeof publishIngestionEvent>;

function parseBody(result: APIGatewayProxyResult) {
    return JSON.parse(result.body);
}

describe('ocpi-tariffs-delete handler', () => {
    beforeEach(() => {
        jest.resetAllMocks();

        mockPublishIngestionEvent.mockResolvedValue(undefined);
    });

    describe('happy path', () => {
        it('returns 200 with OCPI status 1000', async () => {
            const result = await handler(buildDeleteEvent());

            expect(result.statusCode).toBe(200);
            expect(parseBody(result).status_code).toBe(1000);
        });

        it('returns null data per OCPI spec', async () => {
            const result = await handler(buildDeleteEvent());

            expect(parseBody(result).data).toBeNull();
        });

        it('publishes a DELETE ingestion event to SQS', async () => {
            await handler(buildDeleteEvent());

            expect(mockPublishIngestionEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'DELETE',
                    type: 'tariffs',
                    object_id: TARIFF_ID,
                    country_code: VALID_TARIFF.country_code,
                    party_id: VALID_TARIFF.party_id,
                    raw: null,
                    delta: null,
                }),
            );
        });
    });

    describe('SQS failure', () => {
        it('returns 500 when SQS publish fails', async () => {
            mockPublishIngestionEvent.mockRejectedValue(new Error('SQS unavailable'));

            const result = await handler(buildDeleteEvent());

            expect(result.statusCode).toBe(500);
        });
    });
});
