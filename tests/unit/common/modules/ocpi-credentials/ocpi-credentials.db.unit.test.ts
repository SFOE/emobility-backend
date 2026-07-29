// Mock only the AWS DynamoDB layer; crypto.utils (hashToken) runs for real so
// we can assert the exact partition key derived from the token.
jest.mock('../../../../../src/common/aws/dynamodb');

import { queryBySk } from '/opt/nodejs/aws/dynamodb';
import { getCredentials } from '/opt/nodejs/modules/ocpi-credentials/ocpi-credentials.db';
import { OCPICredentialItem } from '/opt/nodejs/modules/ocpi-credentials/ocpi-credentials.model';
import { hashToken } from '/opt/nodejs/utils/crypto.utils';
import { Aws } from '/opt/nodejs/aws/constants';

const mockQueryBySk = queryBySk as jest.MockedFunction<typeof queryBySk>;

const TABLE = Aws.dynamoDBTables.credentials;

const RAW_TOKEN = 'token-c-plain';
const ENCODED_TOKEN = Buffer.from(RAW_TOKEN, 'utf8').toString('base64');

const CREDENTIAL_ITEM = {
  pk: `TOKEN#${hashToken(RAW_TOKEN)}`,
  sk: 'CREDENTIALS',
} as OCPICredentialItem;

describe('getCredentials', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns the credential when the raw token matches on the first lookup', async () => {
    mockQueryBySk.mockResolvedValue(CREDENTIAL_ITEM);

    const result = await getCredentials(RAW_TOKEN);

    expect(result).toBe(CREDENTIAL_ITEM);
    expect(mockQueryBySk).toHaveBeenCalledTimes(1);
    expect(mockQueryBySk).toHaveBeenCalledWith(
        TABLE,
        `TOKEN#${hashToken(RAW_TOKEN)}`,
        'CREDENTIALS',
    );
  });

  it('retries with the Base64-decoded token when the raw lookup misses', async () => {
    // First lookup (encoded token) misses, second lookup (decoded token) hits.
    mockQueryBySk
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(CREDENTIAL_ITEM);

    const result = await getCredentials(ENCODED_TOKEN);

    expect(result).toBe(CREDENTIAL_ITEM);
    expect(mockQueryBySk).toHaveBeenCalledTimes(2);
    expect(mockQueryBySk).toHaveBeenNthCalledWith(
        1,
        TABLE,
        `TOKEN#${hashToken(ENCODED_TOKEN)}`,
        'CREDENTIALS',
    );
    expect(mockQueryBySk).toHaveBeenNthCalledWith(
        2,
        TABLE,
        `TOKEN#${hashToken(RAW_TOKEN)}`,
        'CREDENTIALS',
    );
  });

  it('returns null when neither the raw nor the decoded token matches', async () => {
    mockQueryBySk.mockResolvedValue(null);

    const result = await getCredentials(ENCODED_TOKEN);

    expect(result).toBeNull();
    expect(mockQueryBySk).toHaveBeenCalledTimes(2);
  });

  it('does not retry when the token is not valid Base64', async () => {
    // '@@@' cannot round-trip through Base64, so no decoded retry is attempted.
    mockQueryBySk.mockResolvedValue(null);

    const result = await getCredentials('@@@');

    expect(result).toBeNull();
    expect(mockQueryBySk).toHaveBeenCalledTimes(1);
  });
});
