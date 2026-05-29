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
import { handler } from '../../../../../../src/functions/api/ocpi/locations/ocpi-locations-put';
import { Aws } from '/opt/nodejs/aws/constants';
import { buildLocationPutEvent } from '../../../../../shared/fixtures/ocpi-locations.fixture';
import { LOCATION_ID, VALID_LOCATION } from '../../../../../shared/test-data/ocpi-locations.data';

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

describe('ocpi-locations-put integration', () => {
    beforeEach(async () => {
        await fetch(`${process.env.MINISTACK_ENDPOINT}/_ministack/reset`, { method: 'POST' });
        await createBucket();
        await createQueue();
    });

    it('returns 200 with OCPI status 1000', async () => {
        const result = await handler(buildLocationPutEvent());

        expect(result.statusCode).toBe(200);
        expect(parseBody(result).status_code).toBe(1000);
    });

    it('stores the raw location payload to S3 under the locations prefix', async () => {
        await handler(buildLocationPutEvent());

        const listed = await s3Client.send(
            new ListObjectsV2Command({ Bucket: BUCKET_NAME, Prefix: 'locations/' }),
        );

        expect(listed.Contents).toHaveLength(1);

        const obj = await s3Client.send(
            new GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: listed.Contents![0].Key!,
            }),
        );
        const stored = JSON.parse(await obj.Body!.transformToString());

        expect(stored).toEqual(VALID_LOCATION);
    });

    it('publishes a PUT ingestion event to SQS with S3 reference', async () => {
        await handler(buildLocationPutEvent());

        const received = await sqsClient.send(
            new ReceiveMessageCommand({ QueueUrl: localQueueUrl, MaxNumberOfMessages: 1 }),
        );

        expect(received.Messages).toHaveLength(1);

        const event = JSON.parse(received.Messages![0].Body!);

        expect(event).toMatchObject({
            action: 'PUT',
            type: 'locations',
            object_id: LOCATION_ID,
            country_code: VALID_LOCATION.country_code,
            party_id: VALID_LOCATION.party_id,
            raw: {
                bucket: BUCKET_NAME,
                key: expect.stringContaining('locations/'),
            },
        });
    });
});
