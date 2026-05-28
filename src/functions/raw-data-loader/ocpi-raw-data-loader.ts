import { SQSHandler, SQSBatchResponse } from 'aws-lambda';
import { Aws } from '/opt/nodejs/aws/constants';
import { IngestionEvent, RawDataRecord, buildRawDataRecord } from '/opt/nodejs/aws/sqs';
import { getRawFromS3, putJsonLinesGzipToS3, createCrossAccountS3Client, buildLandingZoneKey } from '/opt/nodejs/aws/s3';

export const handler: SQSHandler = async (event): Promise<SQSBatchResponse> => {
  const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];
  const successfulRecords: Array<{ messageId: string; record: RawDataRecord }> = [];

  // Process each SQS message individually so one failure doesn't block the rest.
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

  // Write all successful records as one JSONL.gz batch to the Landing Zone.
  if (successfulRecords.length > 0) {
    const batchKey = buildLandingZoneKey(new Date());
    const batchRecords = successfulRecords.map(({ record }) => record);
    const crossAccountClient = await createCrossAccountS3Client(Aws.crossAccountRoleLandingZoneArn); // assume cross-account role once per invocation

    try {
      // TODO: Delete later — logs full payloads, expensive in CloudWatch and risks exposing sensitive data
      console.info(`[raw-data-loader][batch] JSONL content (${batchRecords.length} records, ~${Buffer.byteLength(batchRecords.map((r) => JSON.stringify(r)).join('\n'))} bytes)`);
      await putJsonLinesGzipToS3(Aws.dataLakeHouseLandingZoneBucketName, batchKey, batchRecords, crossAccountClient);
      console.info(`[raw-data-loader][batch] Wrote ${batchRecords.length} records to s3://${Aws.dataLakeHouseLandingZoneBucketName}/${batchKey}`);
    } catch (err) {
      console.error(`[raw-data-loader][batch] Failed to write batch to s3://${Aws.dataLakeHouseLandingZoneBucketName}/${batchKey}:`, err);
      batchItemFailures.push(...successfulRecords.map(({ messageId }) => ({ itemIdentifier: messageId }))); // retry all messages so no data is lost
    }
  }

  return { batchItemFailures };
};