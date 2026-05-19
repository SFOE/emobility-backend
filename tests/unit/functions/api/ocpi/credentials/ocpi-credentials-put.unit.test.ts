// Mocks, prevents real AWS calls during tests.
jest.mock('../../../../../../src/common/aws/secrets-manager');
jest.mock('../../../../../../src/common/modules/ocpi-credentials/ocpi-credentials.db');
jest.mock('../../../../../../src/common/utils/crypto.utils');
jest.mock('../../../../../../src/common/utils/ocpi-utils');

import { APIGatewayProxyResult } from 'aws-lambda';
import { handler } from '../../../../../../src/functions/api/ocpi/credentials/ocpi-credentials-put';
import { updatePartySecret } from '../../../../../../src/common/aws/secrets-manager';
import { rotateCredentialsToken } from '../../../../../../src/common/modules/ocpi-credentials/ocpi-credentials.db';
import { generateToken } from '../../../../../../src/common/utils/crypto.utils';
import {
    getPrimaryRole,
    validateCredentialsPayload,
} from '../../../../../../src/common/utils/ocpi-utils';
import { BFE_HUB_PARTY_ID, BFE_ROLE } from '../../../../../../src/common/config.constants';
import { buildEvent } from '../../../../../shared/fixtures/ocpi-credentials.fixture';
import {
    SECRET_ID,
    VALID_CREDENTIAL,
} from '../../../../../shared/test-data/ocpi-credentials.data';

const mockUpdatePartySecret = updatePartySecret as jest.MockedFunction<typeof updatePartySecret>;
const mockRotateCredentialsToken = rotateCredentialsToken as jest.MockedFunction<typeof rotateCredentialsToken>;
const mockGenerateToken = generateToken as jest.MockedFunction<typeof generateToken>;
const mockGetPrimaryRole = getPrimaryRole as jest.MockedFunction<typeof getPrimaryRole>;
const mockValidateCredentialsPayload =
    validateCredentialsPayload as jest.MockedFunction<typeof validateCredentialsPayload>;

function parseBody(result: APIGatewayProxyResult) {
    return JSON.parse(result.body);
}

const AUTH_CONTEXT = {
    isBootstrap: false,
    partnerId: 'CPO-XYZ-DE',
    secretRef: SECRET_ID,
    credentialPk: 'TOKEN#old-token-c-hash',
};

describe('ocpi-credentials-put handler', () => {
    const ORIGINAL_ENV = process.env;

    beforeEach(() => {
        jest.resetAllMocks();
        process.env = { ...ORIGINAL_ENV, BASE_URL: 'https://bfe.example.com' };

        mockGenerateToken.mockReturnValue('new-generated-token-c');
        mockUpdatePartySecret.mockResolvedValue(undefined);
        mockRotateCredentialsToken.mockResolvedValue({
            pk: 'TOKEN#new-token-c-hash',
            sk: 'CREDENTIALS',
            secretRef: SECRET_ID,
            url: VALID_CREDENTIAL.url,
            hub_party_id: VALID_CREDENTIAL.hub_party_id,
            roles: VALID_CREDENTIAL.roles,
            createdAt: new Date().toISOString(),
        });
        mockGetPrimaryRole.mockReturnValue(VALID_CREDENTIAL.roles[0]);
        mockValidateCredentialsPayload.mockReturnValue(null);
    });

    describe('BASE_URL guard', () => {
        it('returns 500 when BASE_URL is not set', async () => {
            delete process.env.BASE_URL;

            const result = await handler(buildEvent({ authContext: AUTH_CONTEXT }));

            expect(result.statusCode).toBe(500);
        });
    });

    describe('bootstrap token guard', () => {
        it('rejects with 405 and OCPI 2000 when request uses a bootstrap token', async () => {
            const result = await handler(
                buildEvent({
                    authContext: {
                        ...AUTH_CONTEXT,
                        isBootstrap: true,
                    },
                }),
            );

            expect(result.statusCode).toBe(405);
            expect(parseBody(result).status_code).toBe(2000);
        });

        it('does not update Secrets Manager or DynamoDB when request uses a bootstrap token', async () => {
            await handler(
                buildEvent({
                    authContext: {
                        ...AUTH_CONTEXT,
                        isBootstrap: true,
                    },
                }),
            );

            expect(mockUpdatePartySecret).not.toHaveBeenCalled();
            expect(mockRotateCredentialsToken).not.toHaveBeenCalled();
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
    });

    describe('payload validation', () => {
        it('rejects with OCPI 2001 when body is missing', async () => {
            const result = await handler(
                buildEvent({
                    body: null,
                    authContext: AUTH_CONTEXT,
                }),
            );

            expect(result.statusCode).toBe(400);
            expect(parseBody(result).status_code).toBe(2001);
        });

        it('rejects with OCPI 2001 when payload validation fails', async () => {
            mockValidateCredentialsPayload.mockReturnValue('Invalid credentials payload!');

            const result = await handler(buildEvent({ authContext: AUTH_CONTEXT }));

            expect(result.statusCode).toBe(400);
            expect(parseBody(result).status_code).toBe(2001);
        });

        it('does not update Secrets Manager or DynamoDB when validation fails', async () => {
            mockValidateCredentialsPayload.mockReturnValue('Invalid credentials payload!');

            await handler(buildEvent({ authContext: AUTH_CONTEXT }));

            expect(mockUpdatePartySecret).not.toHaveBeenCalled();
            expect(mockRotateCredentialsToken).not.toHaveBeenCalled();
        });
    });

    describe('happy path', () => {
        it('returns 200 with OCPI status 1000', async () => {
            const result = await handler(buildEvent({ authContext: AUTH_CONTEXT }));

            expect(result.statusCode).toBe(200);
            expect(parseBody(result).status_code).toBe(1000);
        });

        it('returns BFE credentials with rotated TOKEN_C', async () => {
            const result = await handler(buildEvent({ authContext: AUTH_CONTEXT }));
            const { data } = parseBody(result);

            expect(data).toEqual({
                token: 'new-generated-token-c',
                url: `${process.env.BASE_URL}/ocpi/versions`,
                hub_party_id: BFE_HUB_PARTY_ID,
                roles: [BFE_ROLE],
            });
        });

        it('updates TOKEN_B and TOKEN_C in Secrets Manager', async () => {
            await handler(buildEvent({ authContext: AUTH_CONTEXT }));

            expect(mockUpdatePartySecret).toHaveBeenCalledWith(
                SECRET_ID,
                VALID_CREDENTIAL.token,
                'new-generated-token-c',
            );
        });

        it('rotates DynamoDB credential token mapping', async () => {
            await handler(buildEvent({ authContext: AUTH_CONTEXT }));

            expect(mockRotateCredentialsToken).toHaveBeenCalledWith(
                AUTH_CONTEXT.credentialPk,
                expect.objectContaining({ token: VALID_CREDENTIAL.token }),
                'new-generated-token-c',
                SECRET_ID,
            );
        });
    });
});
