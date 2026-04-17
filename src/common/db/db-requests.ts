import {
  GetCommand,
  GetCommandInput,
  PutCommand,
  QueryCommand,
  QueryCommandInput,
  ScanCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { dynamoDocClient } from '/opt/nodejs/aws.constants';

export const getItem = async <T>(
  tableName: string,
  params: GetCommandInput,
): Promise<T> => {
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

export const queryByPk = async <T>(
  tableName: string,
  pk: string,
): Promise<T[]> => {
  try {
    const items: T[] = [];
    const params: QueryCommandInput = {
      TableName: tableName,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': pk,
      },
    };

    let lastEvaluatedKey: Record<string, unknown> | undefined;

    do {
      const response = await dynamoDocClient.send(
        new QueryCommand({
          ...params,
          ExclusiveStartKey: lastEvaluatedKey,
        }),
      );

      items.push(...((response.Items ?? []) as T[]));
      lastEvaluatedKey = response.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return items;
  } catch (err) {
    console.error(err);
    const message = `Error querying items from DynamoDB table ${tableName} with pk=${pk}`;
    console.error(message);
    throw new Error(message);
  }
};

export const queryBySk = async <T>(
  tableName: string,
  pk: string,
  sk: string,
): Promise<T | null> => {
  try {
    const response = await dynamoDocClient.send(
      new GetCommand({
        TableName: tableName,
        Key: {
          pk: pk,
          sk: sk,
        },
      }),
    );

    return (response.Item as T) ?? null;
  } catch (err) {
    console.error(err);
    const message = `Error query by ak for sk ${sk}`;
    console.error(message);
    throw new Error(message);
  }
};

export const saveItem = async <T extends Record<string, any> | undefined>(
  tableName: string,
  item: T,
): Promise<void> => {
  try {
    await dynamoDocClient.send(
      new PutCommand({
        TableName: tableName,
        Item: item,
      }),
    );
  } catch (err) {
    console.error(err);
    const message = `Error saving item to DynamoDB table ${tableName}`;
    throw new Error(message);
  }
};
