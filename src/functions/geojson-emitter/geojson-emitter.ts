/**
 * Lambda entry point + pure orchestration.
 *
 * `run()` takes its I/O steps as injected callables, so the pipeline's wiring
 * is testable with plain fakes – no AWS credentials, no AWS-mocking library.
 * `handler` itself stays a thin, untested driver (same convention as the
 * existing handlers).
 *
 * A DynamoDB scan failure does not abort the run: `run()` falls back to an
 * empty status overlay so the GeoJSON still gets rewritten with Gold's baked-in
 * fallback status, refreshing at the Gold cadence instead of not at all. This
 * also means the emitter can be deployed ahead of DynamoDB/the status API.
 *
 * The DynamoDB client is created once at module scope for warm-invocation reuse.
 * The S3 client is created per invocation via STS AssumeRole so that credentials
 * never expire mid-run (STS sessions are valid for 1 hour by default).
 */

import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { getRequiredLambdaEnv } from '/opt/nodejs/utils/api.utils';
import { createCrossAccountS3Client } from '/opt/nodejs/aws/s3';
import { overlayStatus, parseStatusItems } from './overlay';
import { buildFeatureCollection } from './render';
import type { GeoJsonFeatureCollection, GoldExport, StatusItem } from './types';

const GOLD_EXPORT_KEY = 'gold_location_serving_export/latest.json';
const GEOJSON_OUTPUT_KEY = 'final_geojson/latest.json';
const REGION = 'eu-central-1';

/** Matches Aws.dynamoDBTables.evseCurrentStatus in src/common/aws/constants.ts */
const EVSE_STATUS_TABLE = 'ocpi-evse-current-status';

// DynamoDB client initialized once per execution environment (same-account, no role assumption needed).
const dynamoDocClient = DynamoDBDocument.from(new DynamoDBClient({ region: REGION }));

async function loadExport(s3Client: S3Client, bucket: string, key: string): Promise<GoldExport> {
  const response = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = await response.Body!.transformToString();
  return JSON.parse(body) as GoldExport;
}

async function scanDynamoStatus(tableName: string): Promise<StatusItem[]> {
  const items: StatusItem[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const response = await dynamoDocClient.scan({
      TableName: tableName,
      ExclusiveStartKey: lastEvaluatedKey,
    });
    items.push(...((response.Items ?? []) as StatusItem[]));
    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return items;
}

async function writeGeoJson(
  s3Client: S3Client,
  bucket: string,
  key: string,
  featureCollection: GeoJsonFeatureCollection,
): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(featureCollection),
      ContentType: 'application/json',
    }),
  );
}

/**
 * Pure orchestration – testable with plain fakes injected for each I/O step.
 *
 * An exception from `loadExportFn` propagates immediately; `writeGeoJsonFn` is
 * never called so a partial result is never published. An exception from
 * `scanStatusFn` is caught and logged; the run continues with an empty status
 * overlay so Gold's baked-in status is used instead.
 */
export async function run(
  loadExportFn: () => Promise<GoldExport>,
  scanStatusFn: () => Promise<StatusItem[]>,
  writeGeoJsonFn: (featureCollection: GeoJsonFeatureCollection) => Promise<void>,
  generatedAt: string,
): Promise<void> {
  const exportData = await loadExportFn();

  let statusByKey;
  try {
    statusByKey = parseStatusItems(await scanStatusFn());
  } catch (err) {
    console.warn(
      `WARNING: DynamoDB status scan failed, falling back to Gold's baked-in status: ${err}`,
    );
    statusByKey = {};
  }

  const overlaidLocations = overlayStatus(exportData.locations, statusByKey);
  const featureCollection = buildFeatureCollection(overlaidLocations, generatedAt);
  await writeGeoJsonFn(featureCollection);
}

export const handler = async (): Promise<void> => {
  const bucket = getRequiredLambdaEnv('TARGET_BUCKET');
  const crossAccountRoleArn = getRequiredLambdaEnv('CROSS_ACCOUNT_ROLE_LANDING_ZONE_ARN');

  const s3Client = await createCrossAccountS3Client(crossAccountRoleArn);

  await run(
    () => loadExport(s3Client, bucket, GOLD_EXPORT_KEY),
    () => scanDynamoStatus(EVSE_STATUS_TABLE),
    (featureCollection) => writeGeoJson(s3Client, bucket, GEOJSON_OUTPUT_KEY, featureCollection),
    new Date().toISOString(),
  );
};
