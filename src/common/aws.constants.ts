import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

export const Aws = {
    region: 'eu-central-1',
};

const dynamoDBClient = new DynamoDBClient({ region: Aws.region });
export const dynamoDocClient = DynamoDBDocument.from(dynamoDBClient);
