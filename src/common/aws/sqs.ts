import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { Aws } from '/opt/nodejs/aws/constants';
import { emitMetric } from '/opt/nodejs/aws/cloudwatch-metrics';

const sqsClient = new SQSClient({ region: Aws.region });

const OCPI_INGESTION_NAMESPACE = 'OCPI/Ingestion';

export type IngestionAction = 'PUT' | 'PATCH' | 'DELETE';
export type IngestionObjectType =
  | 'tariffs'
  | 'locations'
  | 'evse'
  | 'connector';

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
  action: IngestionAction; // PUT | PATCH | DELETE
  type: IngestionObjectType; // locations | evse | connector | tariffs
  object_id: string; // location: "LOC001"; evse: "LOC001*EVSE001"; connector: "LOC001*EVSE001*1"; tariff: "TARIFF001"
  country_code: string;
  party_id: string;
  ocpi_version: string;
  received_at: string;
  payload: unknown | null; // PUT/PATCH: full or partial OCPI object fetched from S3; DELETE: null
}

// Merges SQS event metadata with the resolved S3 payload into a flat RawDataRecord.
export const buildRawDataRecord = (
  event: IngestionEvent,
  rawPayload: unknown | null,
): RawDataRecord => ({
  action: event.action,
  type: event.type,
  object_id: event.object_id,
  country_code: event.country_code,
  party_id: event.party_id,
  ocpi_version: event.ocpi_version,
  received_at: event.received_at,
  payload: rawPayload, // populated for PUT and PATCH events
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

  // Every successfully queued object emits one data point so the CloudWatch
  // dashboard can break volume down by CPO, object type, action and OCPI
  // version without scanning logs. This is the single choke point all write
  // handlers pass through, so no per-handler instrumentation is needed.
  emitIngestionMetric(event);
};

// Maps an ingestion object type to its OCPI module. EVSEs and connectors are
// part of the Locations module, tariffs are their own module.
const ocpiModuleOf = (type: IngestionObjectType): 'locations' | 'tariffs' =>
  type === 'tariffs' ? 'tariffs' : 'locations';

// Emits an `ObjectsIngested` EMF metric for a published ingestion event.
const emitIngestionMetric = (event: IngestionEvent): void => {
  emitMetric({
    namespace: OCPI_INGESTION_NAMESPACE,
    metricName: 'ObjectsIngested',
    value: 1,
    unit: 'Count',
    dimensionSets: [
      ['type'],
      ['ocpi_version'],
      // Per-CPO breakdown including `action`, so dashboards can isolate e.g.
      // only new/replaced objects (PUT) per CPO rather than all writes.
      ['country_code', 'party_id', 'type', 'action'],
      // Per-CPO breakdown rolled up to the OCPI module (locations incl. EVSE +
      // connector, tariffs), so dashboards can show one line per CPO per module.
      ['country_code', 'party_id', 'module'],
    ],
    dimensions: {
      type: event.type,
      action: event.action,
      module: ocpiModuleOf(event.type),
      country_code: event.country_code,
      party_id: event.party_id,
      ocpi_version: event.ocpi_version,
    },
    properties: {
      object_id: event.object_id,
    },
  });
};
