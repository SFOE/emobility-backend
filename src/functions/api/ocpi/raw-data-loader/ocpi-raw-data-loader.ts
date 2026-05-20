import { SQSHandler, SQSBatchResponse } from 'aws-lambda';
import { IngestionEvent, IngestionAction, IngestionObjectType } from '/opt/nodejs/aws/sqs';
import { getRawFromS3 } from '/opt/nodejs/aws/s3';

// Enriched record: SQS metadata + S3 payload + PATCH delta, ready for downstream processing.
interface RawDataRecord {
  action: IngestionAction;
  type: IngestionObjectType;
  object_id: string;
  country_code: string;
  party_id: string;
  ocpi_version: string;
  received_at: string;
  payload: unknown | null;               // PUT: full OCPI object from S3; PATCH/DELETE: null
  delta: Record<string, unknown> | null; // PATCH: embedded diff; PUT/DELETE: null
  raw: { bucket: string; key: string } | null;
}

// Merges SQS event metadata with the resolved S3 payload into a flat RawDataRecord.
const buildRawDataRecord = (
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
  payload: rawPayload,
  delta: event.delta,
  raw: event.raw,
});

export const handler: SQSHandler = async (event): Promise<SQSBatchResponse> => {
  const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];

  for (const record of event.Records) {
    try {
      const ingestionEvent: IngestionEvent = JSON.parse(record.body);

      // Fetch the full OCPI object from S3 only when a raw reference is present (PUT).
      let rawPayload: unknown | null = null;
      if (ingestionEvent.raw !== null) {
        rawPayload = await getRawFromS3(
          ingestionEvent.raw.bucket,
          ingestionEvent.raw.key,
        );
        console.info(
          `[raw-data-loader][process] Fetched s3://${ingestionEvent.raw.bucket}/${ingestionEvent.raw.key}`,
        );
      }

      const rawDataRecord = buildRawDataRecord(ingestionEvent, rawPayload);

      console.info(
        `[raw-data-loader][record] ${JSON.stringify(rawDataRecord)}`,
      );
    } catch (err) {
      console.error(
        `[raw-data-loader][process] Failed to process message ${record.messageId}:`,
        err,
      );
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};
