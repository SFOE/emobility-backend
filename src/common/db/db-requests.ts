import {
  DeleteCommand,
  GetCommand,
  GetCommandInput,
  PutCommand,
  QueryCommand,
  QueryCommandInput,
  ScanCommandInput,
  UpdateCommand,
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

export const saveItem = async (
  tableName: string,
  item: object,
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

export const updateItem = async (
  tableName: string,
  pk: string,
  sk: string,
  updateExpression: string,
  expressionAttributeValues: Record<string, unknown>,
): Promise<void> => {
  try {
    await dynamoDocClient.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { pk, sk },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues,
      }),
    );
  } catch (err) {
    console.error(err);
    const message = `Error updating item in DynamoDB table ${tableName}`;
    throw new Error(message);
  }
};

/**
 * Deletes an item from a DynamoDB table by primary key.
 */
export const deleteItem = async (
    tableName: string,
    pk: string,
    sk: string,
): Promise<void> => {
  try {
    await dynamoDocClient.send(
        new DeleteCommand({
          TableName: tableName,
          Key: { pk, sk },
        }),
    );
  } catch (err) {
    console.error(err);
    const message = `Error deleting item from DynamoDB table ${tableName}`;
    throw new Error(message);
  }
};