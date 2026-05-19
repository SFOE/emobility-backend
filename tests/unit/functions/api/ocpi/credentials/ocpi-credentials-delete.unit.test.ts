jest.mock('../../../../../../src/common/aws/secrets-manager');
jest.mock('../../../../../../src/common/modules/ocpi-credentials/ocpi-credentials.db');

import { APIGatewayProxyResult } from 'aws-lambda';
import { handler } from '../../../../../../src/functions/api/ocpi/credentials/ocpi-credentials-delete';
import { deletePartySecret } from '../../../../../../src/common/aws/secrets-manager';
import { deleteCredentials } from '../../../../../../src/common/modules/ocpi-credentials/ocpi-credentials.db';
import { buildEvent } from '../../../../../shared/fixtures/ocpi-credentials.fixture';
import { SECRET_ID } from '../../../../../shared/test-data/ocpi-credentials.data';

const mockDeletePartySecret = deletePartySecret as jest.MockedFunction<
    typeof deletePartySecret
>;

const mockDeleteCredentials = deleteCredentials as jest.MockedFunction<
    typeof deleteCredentials
>;

function parseBody(result: APIGatewayProxyResult) {
    return JSON.parse(result.body);
}

const AUTH_CONTEXT = {
    isBootstrap: false,
    partnerId: 'CPO-XYZ-DE',
    secretRef: SECRET_ID,
    credentialPk: 'TOKEN#current-token-c-hash',
};

describe('ocpi-credentials-delete handler', () => {
    beforeEach(() => {
        jest.resetAllMocks();

        mockDeletePartySecret.mockResolvedValue(undefined);
        mockDeleteCredentials.mockResolvedValue(undefined);
    });

    describe('happy path', () => {
        it('returns 200 with OCPI status 1000', async () => {
            const result = await handler(buildEvent({ authContext: AUTH_CONTEXT }));

            expect(result.statusCode).toBe(200);
            expect(parseBody(result).status_code).toBe(1000);
        });

        it('deletes the party secret from Secrets Manager', async () => {
            await handler(buildEvent({ authContext: AUTH_CONTEXT }));

            expect(mockDeletePartySecret).toHaveBeenCalledWith(SECRET_ID);
        });

        it('deletes the credential mapping from DynamoDB', async () => {
            await handler(buildEvent({ authContext: AUTH_CONTEXT }));

            expect(mockDeleteCredentials).toHaveBeenCalledWith(
                AUTH_CONTEXT.credentialPk,
            );
        });

        it('deletes the secret before deleting the DynamoDB credentials', async () => {
            await handler(buildEvent({ authContext: AUTH_CONTEXT }));

            const secretDeleteOrder = mockDeletePartySecret.mock.invocationCallOrder[0];
            const credentialDeleteOrder =
                mockDeleteCredentials.mock.invocationCallOrder[0];

            expect(secretDeleteOrder).toBeLessThan(credentialDeleteOrder);
        });
    });

    describe('error handling', () => {
        it('returns 500 when deleting the party secret fails', async () => {
            mockDeletePartySecret.mockRejectedValue(new Error('Secrets failed'));

            const result = await handler(buildEvent({ authContext: AUTH_CONTEXT }));

            expect(result.statusCode).toBe(500);
            expect(mockDeleteCredentials).not.toHaveBeenCalled();
        });

        it('returns 500 when deleting DynamoDB credentials fails', async () => {
            mockDeleteCredentials.mockRejectedValue(new Error('DynamoDB failed'));

            const result = await handler(buildEvent({ authContext: AUTH_CONTEXT }));

            expect(result.statusCode).toBe(500);
            expect(mockDeletePartySecret).toHaveBeenCalledWith(SECRET_ID);
        });
    });
});
