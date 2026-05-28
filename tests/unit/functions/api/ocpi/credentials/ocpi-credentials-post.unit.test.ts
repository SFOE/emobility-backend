// Mocks, prevents real AWS calls during tests.
jest.mock('../../../../../../src/common/aws/secrets-manager');
jest.mock('../../../../../../src/common/modules/ocpi-credentials/ocpi-credentials.db');
jest.mock('../../../../../../src/common/utils/crypto.utils');
jest.mock('../../../../../../src/common/utils/ocpi-utils');

import { APIGatewayProxyResult } from 'aws-lambda';
import { handler } from '../../../../../../src/functions/api/ocpi/credentials/ocpi-credentials-post';
import { partySecretExists, savePartySecret } from '/opt/nodejs/aws/secrets-manager';
import { saveNewCredentials, invalidateBootstrapToken } from '/opt/nodejs/modules/ocpi-credentials/ocpi-credentials.db';
import { generateToken } from '/opt/nodejs/utils/crypto.utils';
import { extractToken, getPrimaryRole, validateCredentialsPayload } from '/opt/nodejs/utils/ocpi-utils';
import { BFE_ROLE } from '/opt/nodejs/config.constants';
import { buildEvent } from '../../../../../shared/fixtures/ocpi-credentials.fixture';
import { BOOTSTRAP_TOKEN, SECRET_ID, VALID_CREDENTIAL } from '../../../../../shared/test-data/ocpi-credentials.data';

// Cast to typed mocks so TypeScript allows mock configuration.
const mockPartySecretExists = partySecretExists as jest.MockedFunction<typeof partySecretExists>;
const mockSavePartySecret = savePartySecret as jest.MockedFunction<typeof savePartySecret>;
const mockSaveNewCredentials = saveNewCredentials as jest.MockedFunction<typeof saveNewCredentials>;
const mockInvalidateBootstrapToken = invalidateBootstrapToken as jest.MockedFunction<typeof invalidateBootstrapToken>;
const mockGenerateToken = generateToken as jest.MockedFunction<typeof generateToken>;
const mockExtractToken = extractToken as jest.MockedFunction<typeof extractToken>;
const mockGetPrimaryRole = getPrimaryRole as jest.MockedFunction<typeof getPrimaryRole>;
const mockValidateCredentialsPayload =
    validateCredentialsPayload as jest.MockedFunction<typeof validateCredentialsPayload>;

// Parses the JSON body from a handler result.
function parseBody(result: APIGatewayProxyResult) {
  return JSON.parse(result.body);
}

describe('ocpi-credentials-post handler', () => {
  // Snapshot env so tests cannot permanently alter it.
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...ORIGINAL_ENV, BASE_URL: 'https://bfe.example.com' };

    // Happy-path defaults. Error-case tests override only the relevant mock.
    mockPartySecretExists.mockResolvedValue(false);
    mockGenerateToken.mockReturnValue('generated-token-c-hex');
    mockSavePartySecret.mockResolvedValue(SECRET_ID);
    mockSaveNewCredentials.mockResolvedValue(undefined);
    mockExtractToken.mockReturnValue(BOOTSTRAP_TOKEN);
    mockInvalidateBootstrapToken.mockResolvedValue(undefined);

    mockGetPrimaryRole.mockReturnValue(VALID_CREDENTIAL.roles[0]);
    mockValidateCredentialsPayload.mockReturnValue(null);
  });

  // BASE_URL is required — without it the handler cannot build its versions URL.
  describe('BASE_URL guard', () => {
    it('returns 500 when BASE_URL is not set', async () => {
      delete process.env.BASE_URL;
      const result = await handler(buildEvent());

      expect(result.statusCode).toBe(500);
    });
  });

  // Prevents re-registration if the party secret already exists in Secrets Manager.
  describe('duplicate registration guard', () => {
    it('rejects with 405 and OCPI 2001 when party secret already exists in Secrets Manager', async () => {
      mockPartySecretExists.mockResolvedValue(true);

      const result = await handler(buildEvent());

      expect(result.statusCode).toBe(405);
      expect(parseBody(result).status_code).toBe(2001);
    });

    it('does not write to Secrets Manager or DynamoDB when party is already registered', async () => {
      mockPartySecretExists.mockResolvedValue(true);

      await handler(buildEvent());

      expect(mockSavePartySecret).not.toHaveBeenCalled();
      expect(mockSaveNewCredentials).not.toHaveBeenCalled();
    });
  });

  // Bootstrap token must be extracted from the Authorization header to invalidate it later.
  describe('bootstrap token extraction', () => {
    it('returns 500 when bootstrap token cannot be extracted from the Authorization header', async () => {
      mockExtractToken.mockReturnValue(null);

      const result = await handler(buildEvent());

      expect(result.statusCode).toBe(500);
    });

    it('does not invalidate bootstrap token when Authorization header extraction fails', async () => {
      mockExtractToken.mockReturnValue(null);

      await handler(buildEvent());

      expect(mockInvalidateBootstrapToken).not.toHaveBeenCalled();
    });
  });

  // Full success flow — all steps complete without errors.
  describe('happy path', () => {
    it('returns 200 with OCPI status 1000', async () => {
      const result = await handler(buildEvent());

      expect(result.statusCode).toBe(200);
      expect(parseBody(result).status_code).toBe(1000);
    });

    it('returns BFE credentials with generated TOKEN_C, versions URL, and NAP role', async () => {
      const result = await handler(buildEvent());
      const { data } = parseBody(result);

      expect(data.token).toBe('generated-token-c-hex');
      expect(data.url).toBe(`${process.env.BASE_URL}/ocpi/versions`);
      expect(data.roles).toEqual([BFE_ROLE]);
    });

    it('saves partner TOKEN_B and generated TOKEN_C to Secrets Manager under the primary role', async () => {
      await handler(buildEvent());

      expect(mockSavePartySecret).toHaveBeenCalledWith(
        expect.objectContaining(VALID_CREDENTIAL.roles[0]),
        VALID_CREDENTIAL.token,
        'generated-token-c-hex',
      );
    });

    it('saves partner credentials and TOKEN_C with its Secrets Manager reference to DynamoDB', async () => {
      await handler(buildEvent());

      expect(mockSaveNewCredentials).toHaveBeenCalledWith(
        expect.objectContaining({ token: VALID_CREDENTIAL.token }),
        'generated-token-c-hex',
        SECRET_ID,
      );
    });

    it('invalidates the bootstrap token after successful registration', async () => {
      await handler(buildEvent());

      expect(mockInvalidateBootstrapToken).toHaveBeenCalledWith(BOOTSTRAP_TOKEN);
    });
  });
});
