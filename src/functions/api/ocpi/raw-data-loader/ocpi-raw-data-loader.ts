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
} from '/opt/nodejs/aws/s3';

// Enriched record: SQS metadata + S3 payload + PATCH delta, ready for downstream data lake ingestion.
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

// Builds a partitioned Landing Zone object key for one Lambda/SQS batch output file.
const buildLandingZoneBatchKey = (timestamp: Date): string => {
  const year = timestamp.getUTCFullYear();
  const month = String(timestamp.getUTCMonth() + 1).padStart(2, '0');
  const day = String(timestamp.getUTCDate()).padStart(2, '0');
  const ts = timestamp.toISOString().replace(/[:.]/g, '');

  return `ocpi-raw/year=${year}/month=${month}/day=${day}/batch_${ts}.jsonl.gz`;
};

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
  const successfulRecords: RawDataRecord[] = [];

  for (const record of event.Records) {
    try {
      const ingestionEvent: IngestionEvent = JSON.parse(record.body);

      // Fetch the full OCPI object from S3 only when a raw reference is present.
      // PUT events store the complete payload in S3, while PATCH/DELETE events carry their data in SQS.
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

      successfulRecords.push(buildRawDataRecord(ingestionEvent, rawPayload));
    } catch (err) {
      console.error(
          `[raw-data-loader][process] Failed to process message ${record.messageId}:`,
          err,
      );

      // Partial batch failure: only failed SQS messages are retried by Lambda/SQS.
      // Successfully processed messages stay acknowledged and are not processed again.
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  if (successfulRecords.length > 0) {
    const batchKey = buildLandingZoneBatchKey(new Date());

    await putJsonLinesGzipToS3(
        Aws.dataLakeHouseLandingZoneBucketName,
        batchKey,
        successfulRecords,
    );

    console.info(
        `[raw-data-loader][batch] Wrote ${successfulRecords.length} records to s3://${Aws.dataLakeHouseLandingZoneBucketName}/${batchKey}`,
    );
  }

  return { batchItemFailures };
};