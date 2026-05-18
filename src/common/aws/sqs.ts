import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { Aws } from '/opt/nodejs/aws/constants';

const sqsClient = new SQSClient({ region: Aws.region });

export type IngestionAction = 'PUT' | 'PATCH' | 'DELETE';
export type IngestionObjectType = 'tariffs' | 'locations' | 'evse' | 'connector';

export interface IngestionEvent {
  action: IngestionAction;
  type: IngestionObjectType;
  object_id: string;
  country_code: string;
  party_id: string;
  ocpi_version: string;
  received_at: string;
  raw: {
    bucket: string;
    key: string;
  } | null;
  // Embedded patch delta — only set for PATCH actions, null otherwise
  delta: Record<string, unknown> | null;
}

// Publishes an ingestion event to SQS for downstream processing.
export const publishIngestionEvent = async (
  event: IngestionEvent,
): Promise<void> => {
  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: Aws.ingestionQueueUrl,
      MessageBody: JSON.stringify(event),
    }),
  );
};
