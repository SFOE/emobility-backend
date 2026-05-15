// globalSetup sets AWS_ENDPOINT_URL_* before workers spawn, so static SDK clients already point to Ministack.
import { APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, CreateTableCommand, ResourceInUseException } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { hashToken } from '../../../../../../src/common/utils/crypto.utils';
import { handler } from '../../../../../../src/functions/api/ocpi/credentials/ocpi-credentials-post';
import { OCPI_CREDENTIALS_TABLE_NAME as TABLE_NAME } from '../../../../../../src/common/db/db-table-names.constants';
import { buildEvent } from '../../../../../shared/fixtures/ocpi-credentials.fixture';
import { VALID_CREDENTIAL, BOOTSTRAP_TOKEN, SECRET_ID } from '../../../../../shared/test-data/ocpi-credentials.data';

// AWS clients — endpoint configured via env vars set in globalSetup.
const clientConfig = { region: 'eu-central-1' };
const dynamoClient = new DynamoDBClient(clientConfig);
const dynamoDoc = DynamoDBDocument.from(dynamoClient);
const secretsClient = new SecretsManagerClient(clientConfig);

async function createTable(): Promise<void> {
  try {
    await dynamoClient.send(
        new CreateTableCommand({
          TableName: TABLE_NAME,
          KeySchema: [
            {AttributeName: 'pk', KeyType: 'HASH'},
            {AttributeName: 'sk', KeyType: 'RANGE'},
          ],
          AttributeDefinitions: [
            {AttributeName: 'pk', AttributeType: 'S'},
            {AttributeName: 'sk', AttributeType: 'S'},
          ],
          BillingMode: 'PAY_PER_REQUEST',
        }),
    );
  } catch (err) {
    if (err instanceof ResourceInUseException) {
      return;
    }

    throw err;
  }
}

async function seedBootstrapToken(): Promise<void> {
  await dynamoDoc.put({
    TableName: TABLE_NAME,
    Item: {
      pk: `TOKEN#${hashToken(BOOTSTRAP_TOKEN)}`,
      sk: 'CREDENTIALS',
      token: BOOTSTRAP_TOKEN,
      url: '',
      roles: [],
      bootstrapToken: true,
      createdAt: new Date().toISOString(),
    },
  });
}

describe('ocpi-credentials-post integration', () => {
  // Resets Ministack state before each test, then re-creates the table and seeds the bootstrap token.
  beforeEach(async () => {
    await fetch(`${process.env.MINISTACK_ENDPOINT}/_ministack/reset`, { method: 'POST' });
    await createTable();
    await seedBootstrapToken();
  });

  it('saves partner credentials with TOKEN_C secret reference to DynamoDB after registration', async () => {
    const result: APIGatewayProxyResult = await handler(buildEvent());
    const tokenC = JSON.parse(result.body).data.token;

    const stored = await dynamoDoc.get({
      TableName: TABLE_NAME,
      Key: { pk: `TOKEN#${hashToken(tokenC)}`, sk: 'CREDENTIALS' },
    });

    expect(stored.Item).toMatchObject({
      sk: 'CREDENTIALS',
      url: VALID_CREDENTIAL.url,
      // token field holds the Secrets Manager reference path, not plaintext
      secretRef: SECRET_ID,
    });
  });

  it('saves partner TOKEN_B and response TOKEN_C to Secrets Manager under the party path', async () => {
    const result: APIGatewayProxyResult = await handler(buildEvent());
    const tokenC = JSON.parse(result.body).data.token;

    const secret = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: SECRET_ID }),
    );
    const value = JSON.parse(secret.SecretString!);

    expect(value.CREDENTIALS_TOKEN_B).toBe(VALID_CREDENTIAL.token);
    expect(value.CREDENTIALS_TOKEN_C).toBe(tokenC);
  });

  it('invalidates the bootstrap token in DynamoDB after registration', async () => {
    await handler(buildEvent());

    const item = await dynamoDoc.get({
      TableName: TABLE_NAME,
      Key: { pk: `TOKEN#${hashToken(BOOTSTRAP_TOKEN)}`, sk: 'CREDENTIALS' },
    });

    expect(item.Item?.bootstrapToken).toBe(false);
  });

  it('rejects a second registration attempt for the same party with 405 and OCPI 2001', async () => {
    await handler(buildEvent());

    // Re-activate the bootstrap token to simulate a second registration attempt
    await dynamoDoc.update({
      TableName: TABLE_NAME,
      Key: { pk: `TOKEN#${hashToken(BOOTSTRAP_TOKEN)}`, sk: 'CREDENTIALS' },
      UpdateExpression: 'SET bootstrapToken = :val',
      ExpressionAttributeValues: { ':val': true },
    });

    const result: APIGatewayProxyResult = await handler(buildEvent());

    expect(result.statusCode).toBe(405);
    expect(JSON.parse(result.body).status_code).toBe(2001);
  });
});
