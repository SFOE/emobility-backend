jest.mock('../../../../../../src/common/aws/sqs');

import { APIGatewayProxyResult } from 'aws-lambda';
import { handler } from '../../../../../../src/functions/api/ocpi/locations/ocpi-locations-patch-connector';
import { publishIngestionEvent } from '../../../../../../src/common/aws/sqs';
import { buildConnectorPatchEvent } from '../../../../../shared/fixtures/ocpi-locations.fixture';
import { CONNECTOR_ID, EVSE_UID, LOCATION_ID, VALID_LOCATION, VALID_PATCH } from '../../../../../shared/test-data/ocpi-locations.data';

const mockPublishIngestionEvent = publishIngestionEvent as jest.MockedFunction<typeof publishIngestionEvent>;

function parseBody(result: APIGatewayProxyResult) {
    return JSON.parse(result.body);
}

describe('ocpi-locations-patch-connector handler', () => {
    beforeEach(() => {
        jest.resetAllMocks();

        mockPublishIngestionEvent.mockResolvedValue(undefined);
    });

    describe('last_updated validation', () => {
        it('returns 400 with OCPI 2001 when last_updated is missing from the patch body', async () => {
            const result = await handler(
                buildConnectorPatchEvent({ body: JSON.stringify({ max_amperage: 16 }) }),
            );

            expect(result.statusCode).toBe(400);
            expect(parseBody(result).status_code).toBe(2001);
        });

        it('returns 400 with OCPI 2001 when last_updated is an empty string', async () => {
            const result = await handler(
                buildConnectorPatchEvent({ body: JSON.stringify({ last_updated: '' }) }),
            );

            expect(result.statusCode).toBe(400);
            expect(parseBody(result).status_code).toBe(2001);
        });

        it('does not publish to SQS when last_updated is missing', async () => {
            await handler(buildConnectorPatchEvent({ body: JSON.stringify({ max_amperage: 16 }) }));

            expect(mockPublishIngestionEvent).not.toHaveBeenCalled();
        });
    });

    describe('happy path', () => {
        it('returns 200 with OCPI status 1000', async () => {
            const result = await handler(buildConnectorPatchEvent());

            expect(result.statusCode).toBe(200);
            expect(parseBody(result).status_code).toBe(1000);
        });

        it('returns null data per OCPI spec', async () => {
            const result = await handler(buildConnectorPatchEvent());

            expect(parseBody(result).data).toBeNull();
        });

        it('publishes a PATCH ingestion event to SQS with composite object_id, delta, and no S3 reference', async () => {
            await handler(buildConnectorPatchEvent());

            expect(mockPublishIngestionEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'PATCH',
                    type: 'connector',
                    object_id: `${LOCATION_ID}*${EVSE_UID}*${CONNECTOR_ID}`,
                    country_code: VALID_LOCATION.country_code,
                    party_id: VALID_LOCATION.party_id,
                    raw: null,
                    delta: VALID_PATCH,
                }),
            );
        });
    });

    describe('SQS failure', () => {
        it('returns 500 when SQS publish fails', async () => {
            mockPublishIngestionEvent.mockRejectedValue(new Error('SQS unavailable'));

            const result = await handler(buildConnectorPatchEvent());

            expect(result.statusCode).toBe(500);
        });
    });
});
