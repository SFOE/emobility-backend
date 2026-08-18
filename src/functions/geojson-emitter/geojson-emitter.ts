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
 * The S3 client reading the Gold export is created per invocation via STS
 * AssumeRole so that credentials never expire mid-run (STS sessions are valid
 * for 1 hour by default). The S3 client writing to the swisstopo bucket
 * (data.geo.admin.ch, foreign account, eu-west-1) uses static IAM access keys
 * loaded from Secrets Manager, since no cross-account role exists there.
 *
 * The GeoJSON is published once per language (de/fr/it/en) with identical
 * content, because the geo.admin.ch layer configuration expects one file per
 * language initially.
 */

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { getRequiredLambdaEnv } from '/opt/nodejs/utils/api.utils';
import {
  createCrossAccountS3Client,
  createStaticCredentialsS3Client,
} from '/opt/nodejs/aws/s3';
import { getS3AccessKeySecret } from '/opt/nodejs/aws/secrets-manager';
import { Aws } from '/opt/nodejs/aws/constants';
import { overlayStatus, parseStatusItems } from './overlay';
import { buildFeatureCollection } from './render';
import type {
  GeoJsonFeatureCollection,
  GoldExport,
  StatusByKey,
  StatusItem,
} from './types';

const GOLD_EXPORT_KEY = 'gold_location_serving_export/latest.json';
const GEOJSON_FILE_BASENAME = 'ch.bfe.ladestellen-elektromobilitaet';
const GEOJSON_LANGUAGES = ['de', 'fr', 'it', 'en'] as const;

const EVSE_STATUS_TABLE = Aws.dynamoDBTables.evseCurrentStatus;

// DynamoDB client initialized once per execution environment (same-account, no role assumption needed).
const dynamoDocClient = DynamoDBDocument.from(
  new DynamoDBClient({ region: Aws.region }),
);

async function loadExport(
  s3Client: S3Client,
  bucket: string,
  key: string,
): Promise<GoldExport> {
  const response = await s3Client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
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

/**
 * Publishes the identical FeatureCollection once per language, since the
 * geo.admin.ch layer configuration expects one file per language.
 */
export async function writeGeoJson(
  s3Client: S3Client,
  bucket: string,
  keyPrefix: string,
  featureCollection: GeoJsonFeatureCollection,
): Promise<void> {
  const body = JSON.stringify(featureCollection);

  await Promise.all(
    GEOJSON_LANGUAGES.map(async (language) => {
      const key = `${keyPrefix}/${GEOJSON_FILE_BASENAME}_${language}.json`;
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: 'application/json',
        }),
      );
      console.log(`GeoJSON successfully written to s3://${bucket}/${key}`);
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
  writeGeoJsonFn: (
    featureCollection: GeoJsonFeatureCollection,
  ) => Promise<void>,
  generatedAt: string,
): Promise<void> {
  const exportData = await loadExportFn();
  const evseCount = exportData.locations.reduce(
    (sum, loc) => sum + loc.evses.length,
    0,
  );
  console.log(
    `Loaded Gold export: ${exportData.locations.length} locations, ${evseCount} EVSEs`,
  );

  let statusByKey: StatusByKey = {};
  let scannedCount = 0;
  try {
    const statusItems = await scanStatusFn();
    scannedCount = statusItems.length;
    statusByKey = parseStatusItems(statusItems);
    console.log(`Scanned ${scannedCount} EVSE status entries from DynamoDB`);
  } catch (err) {
    console.warn(
      `WARNING: DynamoDB status scan failed, falling back to Gold's baked-in status: ${err}`,
    );
  }

  const { locations: overlaidLocations, appliedCount } = overlayStatus(
    exportData.locations,
    statusByKey,
  );
  const featureCollection = buildFeatureCollection(
    overlaidLocations,
    generatedAt,
  );

  console.log(
    `Applied live status to ${appliedCount} of ${evseCount} EVSEs (${scannedCount - appliedCount} DynamoDB entries had no matching EVSE)`,
  );

  await writeGeoJsonFn(featureCollection);
}

export const handler = async (): Promise<void> => {
  const goldBucket = getRequiredLambdaEnv('TARGET_BUCKET');
  const crossAccountRoleArn = getRequiredLambdaEnv(
    'CROSS_ACCOUNT_ROLE_LANDING_ZONE_ARN',
  );

  const goldS3Client = await createCrossAccountS3Client(crossAccountRoleArn);

  const swisstopoCredentials = await getS3AccessKeySecret(
    Aws.swisstopoCredentialsSecretName,
  );
  const swisstopoS3Client = createStaticCredentialsS3Client(
    Aws.swisstopoBucketRegion,
    {
      accessKeyId: swisstopoCredentials.ACCESS_KEY_ID,
      secretAccessKey: swisstopoCredentials.SECRET_ACCESS_KEY,
    },
  );

  await run(
    () => loadExport(goldS3Client, goldBucket, GOLD_EXPORT_KEY),
    () => scanDynamoStatus(EVSE_STATUS_TABLE),
    (featureCollection) =>
      writeGeoJson(
        swisstopoS3Client,
        Aws.swisstopoBucketName,
        Aws.swisstopoGeoJsonKeyPrefix,
        featureCollection,
      ),
    new Date().toISOString(),
  );
};
