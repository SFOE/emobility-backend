import { SQSHandler, SQSBatchResponse } from 'aws-lambda';
import { Aws } from '/opt/nodejs/aws/constants';
import {
  IngestionEvent,
  IngestionAction,
  IngestionObjectType,
} from '/opt/nodejs/aws/sqs';
import {
  getRawFromS3,
  putJsonLinesGzipToS3,
  createCrossAccountS3Client,
} from '/opt/nodejs/aws/s3';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawDataRecord {
  action: IngestionAction;                       // PUT | PATCH | DELETE
  type: IngestionObjectType;                     // locations | evse | connector | tariffs
  object_id: string;                            // location: "LOC001"; evse: "LOC001*EVSE001"; connector: "LOC001*EVSE001*1"; tariff: "TARIFF001"
  country_code: string;
  party_id: string;
  ocpi_version: string;
  received_at: string;
  payload: unknown | null;                       // PUT: full OCPI object from S3; PATCH/DELETE: null
  delta: Record<string, unknown> | null;         // PATCH: changed fields as diff; PUT/DELETE: null
  raw: { bucket: string; key: string } | null;  // S3 reference to original object; null for PATCH/DELETE
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Builds a Hive-partitioned S3 key per module group.
// Example: ocpi-raw/module=locations/year=2026/month=05/day=28/20260528T112631000Z.jsonl.gz
// action, country_code and party_id are intentionally excluded from the path — stored in the record and filterable via Athena content-filter.
const buildLandingZoneKey = (type: IngestionObjectType, timestamp: Date): string => {
  const year = timestamp.getUTCFullYear();
  const month = String(timestamp.getUTCMonth() + 1).padStart(2, '0');
  const day = String(timestamp.getUTCDate()).padStart(2, '0');
  const ts = timestamp.toISOString().replace(/[:.]/g, ''); // colons/dots removed for safe S3 filenames

  return `ocpi-raw/module=${type}/year=${year}/month=${month}/day=${day}/${ts}.jsonl.gz`;
};

// Merges SQS event metadata with the resolved S3 payload into a flat RawDataRecord.
const buildRawDataRecord = (event: IngestionEvent, rawPayload: unknown | null): RawDataRecord => ({
  action: event.action,
  type: event.type,
  object_id: event.object_id,
  country_code: event.country_code,
  party_id: event.party_id,
  ocpi_version: event.ocpi_version,
  received_at: event.received_at,
  payload: rawPayload,  // populated only for PUT events
  delta: event.delta,   // populated only for PATCH events
  raw: event.raw,
});

// ─── Handler ──────────────────────────────────────────────────────────────────

export const handler: SQSHandler = async (event): Promise<SQSBatchResponse> => {
  const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];
  const successfulRecords: Array<{ messageId: string; record: RawDataRecord }> = [];

  // Phase 1: process each SQS message individually so one failure doesn't block the rest.
  for (const record of event.Records) {
    try {
      const ingestionEvent: IngestionEvent = JSON.parse(record.body);

      let rawPayload: unknown | null = null;
      // PUT events store the full object in S3; PATCH/DELETE carry data inline.
      if (ingestionEvent.raw !== null) {
        rawPayload = await getRawFromS3(ingestionEvent.raw.bucket, ingestionEvent.raw.key);
        console.info(`[raw-data-loader][process] Fetched s3://${ingestionEvent.raw.bucket}/${ingestionEvent.raw.key}`);
      }

      successfulRecords.push({ messageId: record.messageId, record: buildRawDataRecord(ingestionEvent, rawPayload) });
    } catch (err) {
      console.error(`[raw-data-loader][process] Failed to process message ${record.messageId}:`, err);
      batchItemFailures.push({ itemIdentifier: record.messageId }); // partial batch failure: only this message is retried
    }
  }

  // Phase 2: group by module and write one JSONL.gz per group to the Landing Zone.
  if (successfulRecords.length > 0) {
    const batchTimestamp = new Date(); // one timestamp per invocation, shared across all groups
    const crossAccountClient = await createCrossAccountS3Client(Aws.crossAccountRoleLandingZoneArn); // assume cross-account role once per invocation
    const groups = new Map<IngestionObjectType, Array<{ messageId: string; record: RawDataRecord }>>();

    for (const item of successfulRecords) {
      const key = item.record.type;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }

    for (const groupItems of groups.values()) {
      const { type } = groupItems[0].record; // all items in a group share this attribute
      const batchKey = buildLandingZoneKey(type, batchTimestamp);
      const batchRecords = groupItems.map(({ record }) => record);

      try {
        console.info(`[raw-data-loader][batch] JSONL content:\n${batchRecords.map((r) => JSON.stringify(r)).join('\n')}`);
        await putJsonLinesGzipToS3(Aws.dataLakeHouseLandingZoneBucketName, batchKey, batchRecords, crossAccountClient);
        console.info(`[raw-data-loader][batch] Wrote ${batchRecords.length} records to s3://${Aws.dataLakeHouseLandingZoneBucketName}/${batchKey}`);
      } catch (err) {
        console.error(`[raw-data-loader][batch] Failed to write batch to s3://${Aws.dataLakeHouseLandingZoneBucketName}/${batchKey}:`, err);
        batchItemFailures.push(...groupItems.map(({ messageId }) => ({ itemIdentifier: messageId }))); // retry all messages in this group
      }
    }
  }

  return { batchItemFailures };
};