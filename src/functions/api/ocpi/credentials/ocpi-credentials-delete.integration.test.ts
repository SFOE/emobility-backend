import { APIGatewayProxyResult } from 'aws-lambda';
import {
    CreateTableCommand,
    DynamoDBClient,
    ResourceInUseException,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import {
    CreateSecretCommand,
    DescribeSecretCommand,
    ResourceExistsException,
    ResourceNotFoundException,
    SecretsManagerClient,
    UpdateSecretCommand,
} from '@aws-sdk/client-secrets-manager';
import { handler } from './ocpi-credentials-delete';
import { hashToken } from '/opt/nodejs/utils/crypto.utils';
import { OCPI_CREDENTIALS_TABLE_NAME as TABLE_NAME } from '/opt/nodejs/db/db-table-names.constants';
import { buildEvent } from '../../../../test/fixtures/ocpi-credentials.fixture';
import {
    SECRET_ID,
    VALID_CREDENTIAL,
} from '../../../../test/test-data/ocpi-credentials.data';

const clientConfig = { region: 'eu-central-1' };
const dynamoClient = new DynamoDBClient(clientConfig);
const dynamoDoc = DynamoDBDocument.from(dynamoClient);
const secretsClient = new SecretsManagerClient(clientConfig);

const TOKEN_C = 'current-token-c';

const AUTH_CONTEXT = {
    isBootstrap: false,
    partnerId: 'CPO-XYZ-DE',
    secretRef: SECRET_ID,
    credentialPk: `TOKEN#${hashToken(TOKEN_C)}`,
};

async function createTable(): Promise<void> {
    try {
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
    } catch (err) {
        if (err instanceof ResourceInUseException) {
            return;
        }

        throw err;
    }
}

async function seedExistingCredentials(): Promise<void> {
    await dynamoDoc.put({
        TableName: TABLE_NAME,
        Item: {
            pk: AUTH_CONTEXT.credentialPk,
            sk: 'CREDENTIALS',
            secretRef: SECRET_ID,
            url: VALID_CREDENTIAL.url,
            roles: VALID_CREDENTIAL.roles,
            bootstrapToken: false,
            createdAt: new Date().toISOString(),
        },
    });
}

async function seedExistingSecret(): Promise<void> {
    const secretString = JSON.stringify({
        CREDENTIALS_TOKEN_B: VALID_CREDENTIAL.token,
        CREDENTIALS_TOKEN_C: TOKEN_C,
    });

    try {
        await secretsClient.send(
            new CreateSecretCommand({
                Name: SECRET_ID,
                SecretString: secretString,
            }),
        );
    } catch (err) {
        if (err instanceof ResourceExistsException) {
            await secretsClient.send(
                new UpdateSecretCommand({
                    SecretId: SECRET_ID,
                    SecretString: secretString,
                }),
            );
            return;
        }

        throw err;
    }
}

function parseBody(result: APIGatewayProxyResult) {
    return JSON.parse(result.body);
}

describe('ocpi-credentials-delete integration', () => {
    beforeEach(async () => {
        await fetch(`${process.env.MINISTACK_ENDPOINT}/_ministack/reset`, {
            method: 'POST',
        });

        await createTable();
        await seedExistingCredentials();
        await seedExistingSecret();
    });

    it('deletes the DynamoDB credential mapping', async () => {
        const result = await handler(buildEvent({ authContext: AUTH_CONTEXT }));

        expect(result.statusCode).toBe(200);
        expect(parseBody(result).status_code).toBe(1000);

        const stored = await dynamoDoc.get({
            TableName: TABLE_NAME,
            Key: {
                pk: AUTH_CONTEXT.credentialPk,
                sk: 'CREDENTIALS',
            },
        });

        expect(stored.Item).toBeUndefined();
    });

    it('deletes the party secret from Secrets Manager', async () => {
        const result = await handler(buildEvent({ authContext: AUTH_CONTEXT }));

        expect(result.statusCode).toBe(200);
        expect(parseBody(result).status_code).toBe(1000);

        await expect(
            secretsClient.send(
                new DescribeSecretCommand({
                    SecretId: SECRET_ID,
                }),
            ),
        ).rejects.toBeInstanceOf(ResourceNotFoundException);
    });

    it('returns 403 and does not delete anything when using a bootstrap token', async () => {
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

        const stored = await dynamoDoc.get({
            TableName: TABLE_NAME,
            Key: {
                pk: AUTH_CONTEXT.credentialPk,
                sk: 'CREDENTIALS',
            },
        });

        expect(stored.Item).toBeDefined();

        const secret = await secretsClient.send(
            new DescribeSecretCommand({
                SecretId: SECRET_ID,
            }),
        );

        expect(secret.Name).toBe(SECRET_ID);
    });

    it('returns 403 and does not delete anything when authorizer context is incomplete', async () => {
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

        const stored = await dynamoDoc.get({
            TableName: TABLE_NAME,
            Key: {
                pk: AUTH_CONTEXT.credentialPk,
                sk: 'CREDENTIALS',
            },
        });

        expect(stored.Item).toBeDefined();

        const secret = await secretsClient.send(
            new DescribeSecretCommand({
                SecretId: SECRET_ID,
            }),
        );

        expect(secret.Name).toBe(SECRET_ID);
    });
});