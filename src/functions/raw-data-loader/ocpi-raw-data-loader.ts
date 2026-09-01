import { SQSBatchResponse, SQSHandler } from 'aws-lambda';
import { Aws } from '/opt/nodejs/aws/constants';
import { buildRawDataRecord, IngestionEvent, RawDataRecord, } from '/opt/nodejs/aws/sqs';
import {
  buildLandingZoneKey,
  createCrossAccountS3Client,
  getRawFromS3,
  putJsonLinesGzipToS3,
} from '/opt/nodejs/aws/s3';

export const handler: SQSHandler = async (
  event,
  context,
): Promise<SQSBatchResponse> => {
  const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];
  const successfulRecords: Array<{ messageId: string; record: RawDataRecord }> =
    [];

  // Process each SQS message individually so one failure doesn't block the rest.
  for (const record of event.Records) {
    try {
      const ingestionEvent: IngestionEvent = JSON.parse(record.body);

      let rawPayload: unknown | null = null;
      // PUT/PATCH store the (full/partial) object in S3 (raw set); DELETE carries no payload (raw null).
      if (ingestionEvent.raw) {
        rawPayload = await getRawFromS3(
          ingestionEvent.raw.bucket,
          ingestionEvent.raw.key,
        );
        console.info(
          `[raw-data-loader][process] Fetched s3://${ingestionEvent.raw.bucket}/${ingestionEvent.raw.key}`,
        );
      }

      successfulRecords.push({
        messageId: record.messageId,
        record: buildRawDataRecord(ingestionEvent, rawPayload),
      });
    } catch (err) {
      console.error(
        `[raw-data-loader][process] Failed to process message ${record.messageId}:`,
        err,
      );
      batchItemFailures.push({ itemIdentifier: record.messageId }); // partial batch failure: only this message is retried
    }
  }

  // Write all successful records as one JSONL.gz batch to the Landing Zone.
  if (successfulRecords.length > 0) {
    // awsRequestId keeps the key unique per invocation so concurrent invocations
    // cannot overwrite each other's batch (silent data loss).
    const batchKey = buildLandingZoneKey(new Date(), context.awsRequestId);
    const batchRecords = successfulRecords.map(({ record }) => record);

    try {
      // Assume the cross-account role inside the try so an STS failure is handled
      // like a write failure (retry all messages) instead of throwing out of the handler.
      const crossAccountClient = await createCrossAccountS3Client(
        Aws.crossAccountRoleLandingZoneArn,
      );
      await putJsonLinesGzipToS3(
        Aws.dataLakeHouseLandingZoneBucketName,
        batchKey,
        batchRecords,
        crossAccountClient,
      );
      console.info(
        `[raw-data-loader][batch] Wrote ${batchRecords.length} records to s3://${Aws.dataLakeHouseLandingZoneBucketName}/${batchKey}`,
      );
    } catch (err) {
      console.error(
        `[raw-data-loader][batch] Failed to write batch to s3://${Aws.dataLakeHouseLandingZoneBucketName}/${batchKey}:`,
        err,
      );
      batchItemFailures.push(
        ...successfulRecords.map(({ messageId }) => ({
          itemIdentifier: messageId,
        })),
      ); // retry all messages so no data is lost
    }
  }

  return { batchItemFailures };
};
