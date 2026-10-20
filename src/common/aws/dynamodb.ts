import {
  ConditionalCheckFailedException,
  DynamoDBClient,
} from '@aws-sdk/client-dynamodb';
import {
  BatchGetCommand,
  DeleteCommand,
  DynamoDBDocument,
  GetCommand,
  GetCommandInput,
  PutCommand,
  QueryCommand,
  QueryCommandInput,
  ScanCommandInput,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { Aws } from '/opt/nodejs/aws/constants';

// Base DynamoDB item key shape
export interface DbKeys {
  pk: string;
  sk?: string;
}

const dynamoDBClient = new DynamoDBClient({ region: Aws.region });
const dynamoDocClient = DynamoDBDocument.from(dynamoDBClient);

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

export const conditionalUpdateItem = async (
  tableName: string,
  pk: string,
  sk: string,
  updateExpression: string,
  expressionAttributeNames: Record<string, string>,
  expressionAttributeValues: Record<string, unknown>,
  conditionExpression: string,
): Promise<boolean> => {
  try {
    await dynamoDocClient.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { pk, sk },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: conditionExpression,
      }),
    );
    return true;
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      return false;
    }
    console.error(err);
    throw new Error(
      `Error conditionally updating item in DynamoDB table ${tableName}`,
    );
  }
};

/**
 * Runs a Query and follows LastEvaluatedKey until `maxItems` items are
 * collected or the key range is exhausted. Every page is capped at 1 MB by
 * DynamoDB, so a single call can return fewer items than requested.
 */
export const queryItems = async <T>(
  params: QueryCommandInput,
  maxItems = Number.POSITIVE_INFINITY,
): Promise<T[]> => {
  try {
    const items: T[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;

    do {
      const remaining = maxItems - items.length;
      const response = await dynamoDocClient.send(
        new QueryCommand({
          ...params,
          ExclusiveStartKey: exclusiveStartKey,
          ...(Number.isFinite(remaining) ? { Limit: remaining } : {}),
        }),
      );

      items.push(...((response.Items ?? []) as T[]));
      exclusiveStartKey = response.LastEvaluatedKey;
    } while (exclusiveStartKey && items.length < maxItems);

    return items;
  } catch (err) {
    console.error(err);
    const message = `Error querying table ${params.TableName} (index ${params.IndexName ?? 'base'})`;
    throw new Error(message);
  }
};

// BatchGetItem accepts at most 100 keys per request.
const BATCH_GET_MAX_KEYS = 100;
const BATCH_GET_MAX_ATTEMPTS = 5;

/**
 * Fetches items by primary key in chunks of 100, resending UnprocessedKeys
 * (with a short backoff). Returns the items found, in no particular order;
 * keys without an item are simply absent from the result.
 */
export const batchGetItems = async <T>(
  tableName: string,
  keys: Record<string, unknown>[],
): Promise<T[]> => {
  const items: T[] = [];

  for (let start = 0; start < keys.length; start += BATCH_GET_MAX_KEYS) {
    let pending: Record<string, unknown>[] = keys.slice(
      start,
      start + BATCH_GET_MAX_KEYS,
    );

    for (
      let attempt = 1;
      pending.length > 0 && attempt <= BATCH_GET_MAX_ATTEMPTS;
      attempt++
    ) {
      try {
        const response = await dynamoDocClient.send(
          new BatchGetCommand({
            RequestItems: { [tableName]: { Keys: pending } },
          }),
        );
        items.push(...((response.Responses?.[tableName] ?? []) as T[]));
        pending = (response.UnprocessedKeys?.[tableName]?.Keys ?? []) as Record<
          string,
          unknown
        >[];
      } catch (err) {
        console.error(err);
        throw new Error(`Error batch-getting items from table ${tableName}`);
      }
      if (pending.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, 50 * 2 ** attempt));
      }
    }

    if (pending.length > 0) {
      throw new Error(
        `Error batch-getting items from table ${tableName}: ${pending.length} keys still unprocessed`,
      );
    }
  }

  return items;
};
