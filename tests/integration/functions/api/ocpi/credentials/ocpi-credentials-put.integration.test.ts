// globalSetup sets AWS_ENDPOINT_URL_* before workers spawn, so static SDK clients already point to Ministack.
import { APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import {
    CreateSecretCommand,
    GetSecretValueCommand,
    SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import { hashToken } from '../../../../../../src/common/utils/crypto.utils';
import { handler } from '../../../../../../src/functions/api/ocpi/credentials/ocpi-credentials-put';
import { OCPI_CREDENTIALS_TABLE_NAME as TABLE_NAME } from '../../../../../../src/common/db/db-table-names.constants';
import { buildEvent } from '../../../../../shared/fixtures/ocpi-credentials.fixture';
import {
    SECRET_ID,
    VALID_CREDENTIAL,
} from '../../../../../shared/test-data/ocpi-credentials.data';

const clientConfig = { region: 'eu-central-1' };
const dynamoClient = new DynamoDBClient(clientConfig);
const dynamoDoc = DynamoDBDocument.from(dynamoClient);
const secretsClient = new SecretsManagerClient(clientConfig);

const OLD_TOKEN_C = 'old-token-c';
const OLD_TOKEN_B = 'old-token-b';

const AUTH_CONTEXT = {
    isBootstrap: false,
    partnerId: 'CPO-XYZ-DE',
    secretRef: SECRET_ID,
    credentialPk: `TOKEN#${hashToken(OLD_TOKEN_C)}`,
};

async function createTable(): Promise<void> {
    await dynamoClient.send(
        new CreateTableCommand({
            TableName: TABLE_NAME,
            KeySchema: [
                { AttributeName: 'pk', KeyType: 'HASH' },
                { AttributeName: 'sk', KeyType: 'RANGE' },
            ],
            AttributeDefinitions: [
                { AttributeName: 'pk', AttributeType: 'S' },
                { AttributeName: 'sk', AttributeType: 'S' },
            ],
            BillingMode: 'PAY_PER_REQUEST',
        }),
    );
}

async function seedExistingCredentials(): Promise<void> {
    await dynamoDoc.put({
        TableName: TABLE_NAME,
        Item: {
            pk: AUTH_CONTEXT.credentialPk,
            sk: 'CREDENTIALS',
            secretRef: SECRET_ID,
            url: 'https://old-cpo.example.com/ocpi/2.3.0',
            roles: VALID_CREDENTIAL.roles,
            bootstrapToken: false,
            createdAt: new Date().toISOString(),
        },
    });
}

async function seedExistingSecret(): Promise<void> {
    await secretsClient.send(
        new CreateSecretCommand({
            Name: SECRET_ID,
            SecretString: JSON.stringify({
                CREDENTIALS_TOKEN_B: OLD_TOKEN_B,
                CREDENTIALS_TOKEN_C: OLD_TOKEN_C,
            }),
        }),
    );
}

function parseBody(result: APIGatewayProxyResult) {
    return JSON.parse(result.body);
}

describe('ocpi-credentials-put integration', () => {
    beforeEach(async () => {
        process.env.BASE_URL = 'https://bfe.example.com';

        await fetch(`${process.env.MINISTACK_ENDPOINT}/_ministack/reset`, {
            method: 'POST',
        });

        await createTable();
        await seedExistingCredentials();
        await seedExistingSecret();
    });

    it('updates TOKEN_B and rotated TOKEN_C in Secrets Manager', async () => {
        const result = await handler(buildEvent({ authContext: AUTH_CONTEXT }));
        const tokenC = parseBody(result).data.token;

        const secret = await secretsClient.send(
            new GetSecretValueCommand({ SecretId: SECRET_ID }),
        );
        const value = JSON.parse(secret.SecretString!);

        expect(value.CREDENTIALS_TOKEN_B).toBe(VALID_CREDENTIAL.token);
        expect(value.CREDENTIALS_TOKEN_C).toBe(tokenC);
        expect(value.CREDENTIALS_TOKEN_C).not.toBe(OLD_TOKEN_C);
    });

    it('creates a new DynamoDB mapping for the rotated TOKEN_C', async () => {
        const result = await handler(buildEvent({ authContext: AUTH_CONTEXT }));
        const tokenC = parseBody(result).data.token;

        const stored = await dynamoDoc.get({
            TableName: TABLE_NAME,
            Key: {
                pk: `TOKEN#${hashToken(tokenC)}`,
                sk: 'CREDENTIALS',
            },
        });

        expect(stored.Item).toMatchObject({
            sk: 'CREDENTIALS',
            secretRef: SECRET_ID,
            url: VALID_CREDENTIAL.url,
            roles: VALID_CREDENTIAL.roles,
        });
    });

    it('deletes the old DynamoDB mapping for the previous TOKEN_C', async () => {
        await handler(buildEvent({ authContext: AUTH_CONTEXT }));

        const oldItem = await dynamoDoc.get({
            TableName: TABLE_NAME,
            Key: {
                pk: AUTH_CONTEXT.credentialPk,
                sk: 'CREDENTIALS',
            },
        });

        expect(oldItem.Item).toBeUndefined();
    });

    it('returns BFE credentials with the rotated TOKEN_C', async () => {
        const result = await handler(buildEvent({ authContext: AUTH_CONTEXT }));
        const { data, status_code } = parseBody(result);

        expect(result.statusCode).toBe(200);
        expect(status_code).toBe(1000);
        expect(data.token).toBeDefined();
        expect(data.token).not.toBe(OLD_TOKEN_C);
        expect(data.url).toBe(`${process.env.BASE_URL}/ocpi/versions`);
        expect(data.hub_party_id).toBe('CHBFE');
        expect(data.roles[0].party_id).toBe('BFE');
        expect(data.roles[0].country_code).toBe('CH');
    });

    it('rejects bootstrap tokens with 403 and does not rotate credentials', async () => {
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

        const oldItem = await dynamoDoc.get({
            TableName: TABLE_NAME,
            Key: {
                pk: AUTH_CONTEXT.credentialPk,
                sk: 'CREDENTIALS',
            },
        });

        expect(oldItem.Item).toBeDefined();
    });
});
