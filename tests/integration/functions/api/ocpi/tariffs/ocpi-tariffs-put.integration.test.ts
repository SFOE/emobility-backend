// globalSetup sets AWS_ENDPOINT_URL_* before workers spawn, so static SDK clients already point to Ministack.
import { APIGatewayProxyResult } from 'aws-lambda';
import {
    CreateBucketCommand,
    GetObjectCommand,
    ListObjectsV2Command,
    S3Client,
} from '@aws-sdk/client-s3';
import {
    CreateQueueCommand,
    ReceiveMessageCommand,
    SQSClient,
} from '@aws-sdk/client-sqs';
import { handler } from '../../../../../../src/functions/api/ocpi/tariffs/ocpi-tariffs-put';
import { Aws } from '/opt/nodejs/aws/constants';
import { buildEvent } from '../../../../../shared/fixtures/ocpi-tariffs.fixture';
import { TARIFF_ID, VALID_TARIFF } from '../../../../../shared/test-data/ocpi-tariffs.data';

const BUCKET_NAME = Aws.rawDataBucketName;
const QUEUE_NAME = Aws.ingestionQueueUrl.split('/').pop()!;

// AWS clients — explicit endpoint so both test-side and handler-side clients hit Ministack.
const endpoint = process.env.MINISTACK_ENDPOINT!;
const clientConfig = { region: Aws.region, endpoint };
const s3Client = new S3Client({ ...clientConfig, forcePathStyle: true });
const sqsClient = new SQSClient(clientConfig);

let localQueueUrl: string;

async function createBucket(): Promise<void> {
    await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
}

async function createQueue(): Promise<void> {
    const result = await sqsClient.send(new CreateQueueCommand({ QueueName: QUEUE_NAME }));
    localQueueUrl = result.QueueUrl!;
}

function parseBody(result: APIGatewayProxyResult) {
    return JSON.parse(result.body);
}

describe('ocpi-tariffs-put integration', () => {
    // Resets Ministack state before each test, then re-creates S3 bucket and SQS queue.
    beforeEach(async () => {
        await fetch(`${process.env.MINISTACK_ENDPOINT}/_ministack/reset`, { method: 'POST' });
        await createBucket();
        await createQueue();
    });

    it('returns 200 with OCPI status 1000', async () => {
        const result = await handler(buildEvent());

        expect(result.statusCode).toBe(200);
        expect(parseBody(result).status_code).toBe(1000);
    });

    it('stores the raw tariff payload to S3 under the tariffs prefix', async () => {
        await handler(buildEvent());

        const listed = await s3Client.send(
            new ListObjectsV2Command({ Bucket: BUCKET_NAME, Prefix: 'tariffs/' }),
        );

        expect(listed.Contents).toHaveLength(1);

        const obj = await s3Client.send(
            new GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: listed.Contents![0].Key!,
            }),
        );
        const stored = JSON.parse(await obj.Body!.transformToString());

        expect(stored).toEqual(VALID_TARIFF);
    });

    it('publishes a PUT ingestion event to SQS with S3 reference', async () => {
        await handler(buildEvent());

        const received = await sqsClient.send(
            new ReceiveMessageCommand({
                QueueUrl: localQueueUrl,
                MaxNumberOfMessages: 1,
            }),
        );

        expect(received.Messages).toHaveLength(1);

        const event = JSON.parse(received.Messages![0].Body!);

        expect(event).toMatchObject({
            action: 'PUT',
            type: 'tariffs',
            object_id: TARIFF_ID,
            country_code: VALID_TARIFF.country_code,
            party_id: VALID_TARIFF.party_id,
            raw: {
                bucket: BUCKET_NAME,
                key: expect.stringContaining('tariffs/'),
            },
        });
    });
});
