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
}

// Flat output record written per ingestion event to the Landing Zone.
export interface RawDataRecord {
  action: IngestionAction;                       // PUT | PATCH | DELETE
  type: IngestionObjectType;                     // locations | evse | connector | tariffs
  object_id: string;                            // location: "LOC001"; evse: "LOC001*EVSE001"; connector: "LOC001*EVSE001*1"; tariff: "TARIFF001"
  country_code: string;
  party_id: string;
  ocpi_version: string;
  received_at: string;
  payload: unknown | null;                       // PUT/PATCH: full or partial OCPI object fetched from S3; DELETE: null
}

// Merges SQS event metadata with the resolved S3 payload into a flat RawDataRecord.
export const buildRawDataRecord = (event: IngestionEvent, rawPayload: unknown | null): RawDataRecord => ({
  action: event.action,
  type: event.type,
  object_id: event.object_id,
  country_code: event.country_code,
  party_id: event.party_id,
  ocpi_version: event.ocpi_version,
  received_at: event.received_at,
  payload: rawPayload,  // populated for PUT and PATCH events
});

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
