jest.mock('/opt/nodejs/utils/secrets.utils');
jest.mock('/opt/nodejs/db/ocpi-credentials/ocpi-credentials.db');

import { APIGatewayProxyResult } from 'aws-lambda';
import { handler } from './ocpi-credentials-delete';
import { deletePartySecret } from '/opt/nodejs/utils/secrets.utils';
import { deleteCredentials } from '/opt/nodejs/db/ocpi-credentials/ocpi-credentials.db';
import { buildEvent } from '../../../../test/fixtures/ocpi-credentials.fixture';
import { SECRET_ID } from '../../../../test/test-data/ocpi-credentials.data';

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

    describe('bootstrap token guard', () => {
        it('rejects with 403 and OCPI 2000 when request uses a bootstrap token', async () => {
            const result = await handler(
                buildEvent({
                    authContext: {
                        ...AUTH_CONTEXT,
                        isBootstrap: true,
                    },
                }),
            );

            expect(result.statusCode).toBe(403);
            expect(parseBody(result).status_code).toBe(2000);
        });

        it('does not delete Secrets Manager secret or DynamoDB credentials when request uses a bootstrap token', async () => {
            await handler(
                buildEvent({
                    authContext: {
                        ...AUTH_CONTEXT,
                        isBootstrap: true,
                    },
                }),
            );

            expect(mockDeletePartySecret).not.toHaveBeenCalled();
            expect(mockDeleteCredentials).not.toHaveBeenCalled();
        });
    });

    describe('authorizer context guard', () => {
        it('rejects with 403 when secretRef is missing', async () => {
            const result = await handler(
                buildEvent({
                    authContext: {
                        ...AUTH_CONTEXT,
                        secretRef: undefined,
                    },
                }),
            );

            expect(result.statusCode).toBe(403);
            expect(parseBody(result).status_code).toBe(2000);
        });

        it('rejects with 403 when credentialPk is missing', async () => {
            const result = await handler(
                buildEvent({
                    authContext: {
                        ...AUTH_CONTEXT,
                        credentialPk: undefined,
                    },
                }),
            );

            expect(result.statusCode).toBe(403);
            expect(parseBody(result).status_code).toBe(2000);
        });

        it('does not delete anything when authorizer context is incomplete', async () => {
            await handler(
                buildEvent({
                    authContext: {
                        ...AUTH_CONTEXT,
                        secretRef: undefined,
                    },
                }),
            );

            expect(mockDeletePartySecret).not.toHaveBeenCalled();
            expect(mockDeleteCredentials).not.toHaveBeenCalled();
        });
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