import { GetCommand, GetCommandInput, ScanCommandInput } from '@aws-sdk/lib-dynamodb';
import { dynamoDocClient } from '/opt/nodejs/aws.constants';

export const getItem = async <T>(tableName: string, params: GetCommandInput): Promise<T> => {
    try {
        const { Item } = await dynamoDocClient.send(new GetCommand(params));
        return Item as T;
    } catch (err) {
        console.error(err);
        const message = `Error fetching item from DynamoDB table ${tableName}`;
        console.error(message);
        throw new Error(message);
    }
};

export const fetchAll = async <T>(tableName: string): Promise<T[]> => {
    try {
        let items: T[] = [];
        const params: ScanCommandInput = { TableName: tableName };

        while (true) {
            const response = await dynamoDocClient.scan(params);
            items.push(...((response.Items ?? []) as T[]));

            if (response.LastEvaluatedKey) {
                params.ExclusiveStartKey = response.LastEvaluatedKey;
            } else {
                return items;
            }
        }
    } catch (err) {
        console.error(err);
        const message = `Error fetching all items from DynamoDB table ${tableName}`;
        console.error(message);
        throw new Error(message);
    }
};
