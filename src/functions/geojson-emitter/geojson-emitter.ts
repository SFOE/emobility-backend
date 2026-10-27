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
import { GEOJSON_LANGUAGES, type Language, TRANSLATIONS } from './translations';
import type {
  GeoJsonFeatureCollection,
  GoldExport,
  StatusByKey,
  StatusItem,
} from './types';

type FeatureCollectionByLanguage = Record<Language, GeoJsonFeatureCollection>;

/**
 * Lambda entry point + pure orchestration.
 *
 * `run()` takes its I/O steps as injected callables, so the pipeline's wiring
 * is testable with plain fakes – no AWS credentials, no AWS-mocking library.
 * `handler` itself stays a thin, untested driver (same convention as the
 * existing handlers).
 *
 * A DynamoDB read failure does not abort the run: `run()` falls back to an
 * empty status overlay so the GeoJSON still gets rewritten with Gold's baked-in
 * fallback status, refreshing at the Gold cadence instead of not at all. This
 * also means the emitter can be deployed ahead of DynamoDB/the status API.
 *
 * Only the status delta is read, not the whole table: every entry older than the
 * Gold export's `generated_at` is already baked into that export, so re-reading
 * it each run would be wasted work. The emitter keeps no state between runs --
 * the export itself carries the baseline, and the window is re-derived from it
 * on every invocation.
 *
 * The DynamoDB client is created once at module scope for warm-invocation reuse.
 * The S3 client reading the Gold export and writing the GeoJSON back into Gold
 * is created per invocation via STS AssumeRole so that credentials never expire
 * mid-run (STS sessions are valid for 1 hour by default).
 *
 * The Gold bucket is always a publication target. The swisstopo bucket
 * (data.geo.admin.ch, foreign account, eu-west-1) is an additional target that
 * is only used when it is configured via the SWISSTOPO_* environment
 * variables; its S3 client uses static IAM access keys loaded from Secrets
 * Manager, since no cross-account role exists there.
 *
 * The GeoJSON is published once per language (de/fr/it/en); each file gets its
 * own translated popup text (see translations.ts), because the geo.admin.ch
 * layer configuration expects one file per language.
 */

const GOLD_EXPORT_KEY = 'gold_location_serving_export/latest.json';
const GOLD_GEOJSON_KEY_PREFIX = 'final_geojson';
const GEOJSON_FILE_BASENAME = 'ch.bfe.ladestellen-elektromobilitaet';

const EVSE_STATUS_TABLE = Aws.dynamoDBTables.evseCurrentStatus;

/**
 * How far back before the Gold export's `generated_at` the status delta starts.
 *
 * The export's baked-in status comes from Silver, which was built before Gold
 * stamped `generated_at`. A status that arrived while the pipeline was running
 * is therefore in neither the export nor a delta starting exactly at
 * `generated_at`, and would silently stay stale until the next Gold run. The
 * buffer covers that gap. Reading a bit extra is harmless -- the overlay is
 * idempotent -- whereas too small a buffer silently publishes stale status, so
 * raise this if the Bronze->Silver->Gold chain ever takes longer than an hour.
 */
const STATUS_DELTA_BUFFER_HOURS = Number(
  process.env.STATUS_DELTA_BUFFER_HOURS ?? 1,
);

const HOUR_IN_MS = 60 * 60 * 1000;

/**
 * Start of the status delta window, or `null` when it cannot be derived and the
 * caller has to fall back to a full scan.
 *
 * Compared lexicographically against `gsi1sk`, which is prefixed with
 * `received_at` (`new Date().toISOString()`, always UTC with a `Z`). The Gold
 * export's `generated_at` lacks that suffix, and `Date.parse` would read a
 * bare timestamp as the Lambda's *local* time -- shifting the window by the
 * host offset. Appending `Z` pins it to UTC, and re-serializing normalizes both
 * sides to the same format so the comparison holds.
 */
export function deltaWindowStart(
  generatedAt: string | undefined,
  bufferHours: number,
): string | null {
  if (!generatedAt) {
    return null;
  }
  const hasTimezone = /(Z|[+-]\d{2}:?\d{2})$/.test(generatedAt);
  const parsed = Date.parse(hasTimezone ? generatedAt : `${generatedAt}Z`);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return new Date(parsed - bufferHours * HOUR_IN_MS).toISOString();
}

// DynamoDB client initialized once per execution environment (same-account, no role assumption needed).
const dynamoDocClient = DynamoDBDocument.from(
  new DynamoDBClient({ region: Aws.region }),
);

// The Gold export key may not exist yet (e.g. before the first Gold Glue run).
// S3 signals that with a NoSuchKey / HTTP 404 on GetObject.
const isMissingKeyError = (err: unknown): boolean => {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404;
};

/**
 * Loads the Gold export, or returns `null` if it does not exist yet so the
 * emitter can run on schedule before Gold has produced any data. Any other
 * S3 or JSON error still propagates.
 */
async function loadExport(
  s3Client: S3Client,
  bucket: string,
  key: string,
): Promise<GoldExport | null> {
  try {
    const response = await s3Client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    const body = await response.Body!.transformToString();
    return JSON.parse(body) as GoldExport;
  } catch (err) {
    if (isMissingKeyError(err)) {
      return null;
    }
    throw err;
  }
}

async function scanAllStatus(tableName: string): Promise<StatusItem[]> {
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
 * Status entries whose `received_at` is at or after `since`, read through gsi1
 * (constant `gsi1pk`, `gsi1sk` = `{received_at}#{cc}#{party}#{location}#{uid}`).
 * The same index backs the public status API's `date_from`.
 *
 * Paginated to completion: the window can legitimately exceed one page right
 * before a Gold run, and a truncated result would silently publish stale status.
 */
async function queryStatusSince(
  tableName: string,
  since: string,
): Promise<StatusItem[]> {
  const items: StatusItem[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const response = await dynamoDocClient.query({
      TableName: tableName,
      IndexName: 'gsi1',
      KeyConditionExpression: 'gsi1pk = :type AND gsi1sk >= :since',
      ExpressionAttributeValues: { ':type': 'EVSE_STATUS', ':since': since },
      ExclusiveStartKey: lastEvaluatedKey,
    });
    items.push(...((response.Items ?? []) as StatusItem[]));
    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return items;
}

/**
 * Everything older than `since` is already baked into the Gold export, so only
 * the delta has to be read. `since === null` means the export carried no usable
 * `generated_at`; then the whole table is scanned, exactly as before.
 */
async function fetchStatus(
  tableName: string,
  since: string | null,
): Promise<StatusItem[]> {
  return since === null
    ? scanAllStatus(tableName)
    : queryStatusSince(tableName, since);
}

/**
 * Publishes one file per language, each with its own translated content.
 */
export async function writeGeoJson(
  s3Client: S3Client,
  bucket: string,
  keyPrefix: string,
  collectionsByLanguage: FeatureCollectionByLanguage,
): Promise<void> {
  await Promise.all(
    GEOJSON_LANGUAGES.map(async (language) => {
      const key = `${keyPrefix}/${GEOJSON_FILE_BASENAME}_${language}.json`;
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: JSON.stringify(collectionsByLanguage[language]),
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
 * `fetchStatusFn` is caught and logged; the run continues with an empty status
 * overlay so Gold's baked-in status is used instead.
 *
 * `fetchStatusFn` receives the start of the delta window derived from the
 * export, or `null` when the export has no usable timestamp and the caller
 * should read everything.
 */
export async function run(
  loadExportFn: () => Promise<GoldExport | null>,
  fetchStatusFn: (since: string | null) => Promise<StatusItem[]>,
  writeGeoJsonFn: (
    collectionsByLanguage: FeatureCollectionByLanguage,
  ) => Promise<void>,
  generatedAt: string,
): Promise<void> {
  const exportData = await loadExportFn();
  if (!exportData) {
    console.warn(
      'Gold export not available yet — skipping GeoJSON generation (no data to publish).',
    );
    // To see the metric in the cloudwatch dashboard
    console.log(`Loaded Gold export: 0 locations, 0 EVSEs`);
    return;
  }
  const evseCount = exportData.locations.reduce(
    (sum, loc) => sum + loc.evses.length,
    0,
  );
  console.log(
    `Loaded Gold export: ${exportData.locations.length} locations, ${evseCount} EVSEs`,
  );

  // Statuses older than this are already in the export, so only the delta is read.
  const windowStart = deltaWindowStart(
    exportData.generated_at,
    STATUS_DELTA_BUFFER_HOURS,
  );
  if (windowStart === null) {
    console.warn(
      'Gold export carries no usable generated_at — falling back to a full status scan.',
    );
  }

  let statusByKey: StatusByKey = {};
  let scannedCount = 0;
  try {
    const statusItems = await fetchStatusFn(windowStart);
    scannedCount = statusItems.length;
    statusByKey = parseStatusItems(statusItems);
    console.log(
      windowStart === null
        ? `Scanned ${scannedCount} EVSE status entries from DynamoDB (full scan)`
        : `Scanned ${scannedCount} EVSE status entries from DynamoDB (changed since ${windowStart})`,
    );
  } catch (err) {
    console.warn(
      `WARNING: DynamoDB status read failed, falling back to Gold's baked-in status: ${err}`,
    );
  }

  const { locations: overlaidLocations, appliedCount } = overlayStatus(
    exportData.locations,
    statusByKey,
  );

  console.log(
    `Applied live status to ${appliedCount} of ${evseCount} EVSEs (${scannedCount - appliedCount} DynamoDB entries had no matching EVSE)`,
  );

  // Build one FeatureCollection per language, each with its own translated text.
  const collectionsByLanguage = Object.fromEntries(
    GEOJSON_LANGUAGES.map((language) => [
      language,
      buildFeatureCollection(
        overlaidLocations,
        generatedAt,
        TRANSLATIONS[language],
      ),
    ]),
  ) as FeatureCollectionByLanguage;

  await writeGeoJsonFn(collectionsByLanguage);
}

export const handler = async (): Promise<void> => {
  const goldBucket = getRequiredLambdaEnv('TARGET_BUCKET');
  const crossAccountRoleArn = getRequiredLambdaEnv(
    'CROSS_ACCOUNT_ROLE_LANDING_ZONE_ARN',
  );

  const goldS3Client = await createCrossAccountS3Client(crossAccountRoleArn);

  // Undefined in environments where the swisstopo publication is not
  // configured (dev); there the GeoJSON is only written back into Gold.
  const swisstopo = Aws.swisstopoConfig;

  await run(
    () => loadExport(goldS3Client, goldBucket, GOLD_EXPORT_KEY),
    (since) => fetchStatus(EVSE_STATUS_TABLE, since),
    async (collectionsByLanguage) => {
      // Gold is written first so a swisstopo failure cannot suppress it.
      await writeGeoJson(
        goldS3Client,
        goldBucket,
        GOLD_GEOJSON_KEY_PREFIX,
        collectionsByLanguage,
      );

      if (swisstopo) {
        // if swisstopo config is here, write GEOJSON to swisstopo
        const credentials = await getS3AccessKeySecret(
          swisstopo.credentialsSecretName,
        );
        await writeGeoJson(
          createStaticCredentialsS3Client(swisstopo.bucketRegion, {
            accessKeyId: credentials.ACCESS_KEY_ID,
            secretAccessKey: credentials.SECRET_ACCESS_KEY,
          }),
          swisstopo.bucketName,
          swisstopo.geoJsonKeyPrefix,
          collectionsByLanguage,
        );
      }
    },
    new Date().toISOString(),
  );
};
