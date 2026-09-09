# EVSE Occupancy Snapshot — Gold table for Superset live-occupancy visualization

## Context

BFE wants a Superset dashboard showing live EVSE occupancy over the trailing 7 days at 15-minute
granularity, sliceable by country, canton, commune, connector type (AC/DC), and LKW/truck
compatibility. The live status itself already exists in the DynamoDB fastpath table
(`ocpi-evse-current-status`) and is already overlaid onto the Gold layer's location export inside
this repo's `geojson-emitter` Lambda — but that overlay is only ever rendered into GeoJSON, never
persisted as a time series. This plan adds a second Lambda that performs the same overlay and,
every 15 minutes, snapshots one row per EVSE into a new time-series Gold table that Superset queries
via Athena.

Two upstream (out-of-repo) changes make this tractable and were confirmed with the user:
- **Done, upstream (`emobility-data-pipelines`).** The Silver→Gold Glue enrichment step now adds
  `country_code` (already present before), `canton`, and `commune` directly onto each location
  object in `gold_location_serving_export/latest.json`, derived by joining `silver_dim_location`'s
  `postal_code` against the existing Swiss Post PLZ reference CSV (the same lookup
  `gold_evse_analytics` already used) — see `silver_to_gold/dims.py:attach_canton_commune` and
  `silver_to_gold/assembly.py:assemble_gold_location_serving` in that repo. `canton`/`commune` are
  `null` for a location whose postal code isn't in the PLZ directory. **This repo does not need to
  join against any PLZ→canton/commune table itself** — those fields can be read straight off
  `GoldLocation`.
- AC/DC and LKW/truck compatibility are derived in this repo from data already present in the Gold
  export (`connector.standard`, `location.vehicle_types`) — no upstream change needed for those.

## Decisions (fixed constraints)

1. **New, separate Lambda** `evse-occupancy-snapshot`, own `rate(15 minutes)` EventBridge trigger
   (the first scheduled trigger in this system — none exists today, including for `geojson-emitter`).
2. **Shared library code**: extract the Gold-export read, DynamoDB status scan, and status-overlay
   logic out of `geojson-emitter` into a shared module so both Lambdas use the same tested functions.
3. **Canton/commune/country**: read directly off the (soon-to-be-enriched) `GoldLocation` object —
   no join, no Athena/Glue SDK usage needed.
4. **AC/DC**: derived per EVSE from `connector.standard` via a static heuristic map, exposed as two
   booleans on the row: `ac_compatible`, `dc_compatible` (both `true` if the EVSE has connectors of
   both kinds; unrecognized standards count toward neither, not a guess).
5. **LKW/truck compatibility**: one boolean per row, inherited from the location's `vehicle_types`
   (`true` if it includes `SEMI_TRACTOR`/`RIGID`/`TRUCK_WITH_TRAILER`).
6. **Row grain**: **one row per EVSE per 15-minute run** (not per connector) — `ac_compatible`/
   `dc_compatible` booleans absorb the multi-connector case instead of emitting multiple rows.
7. **Storage**: Parquet on S3, partitioned by date only (`year=/month=/day=`), one small file
   appended per 15-min run; Athena/Glue Data Catalog table on top for Superset to query.
8. **Retention**: indefinite growth — no TTL/lifecycle deletion; Superset's own query filters to the
   trailing 7 days.
9. **Partition registration**: **Athena partition projection**, configured declaratively on the Glue
   table (infra-repo concern), not runtime `BatchCreatePartition` calls — keeps this Lambda's IAM
   footprint to S3 read/write + DynamoDB scan only, identical in shape to `geojson-emitter` today.
   Unlike this repo's Iceberg tables (`gold_location_serving`/`gold_evse_analytics`, mirrored into
   the lakehouse account's catalog after every Glue run because an Iceberg commit changes the
   table's `metadata_location` pointer), this table is plain Hive-style Parquet with no analogous
   pointer — the Glue table's schema, `Location`, and partition-projection formula are set **once**
   and never touched again. Athena computes valid partition values from the formula at query time
   (it never consults stored partition metadata), so a new file the Lambda drops under the right
   key is queryable on the very next query with zero registration step of any kind — nothing to
   mirror, nothing to run per invocation. Concretely, the projection config (set on the Glue table
   itself, via Terraform, in the infra repo):
   ```
   projection.enabled                = true
   projection.year.type              = integer
   projection.year.range             = 2026,NOW
   projection.month.type             = integer
   projection.month.range            = 1,12
   projection.month.digits           = 2
   projection.day.type               = integer
   projection.day.range              = 1,31
   projection.day.digits             = 2
   storage.location.template         = s3://<gold-bucket>/evse_occupancy_snapshot/year=${year}/month=${month}/day=${day}/
   ```
   The `year` range's upper bound **must** be `NOW` (relative), not a hardcoded literal — a fixed
   end date would silently stop returning new rows once exhausted, with no error, no alarm, nothing
   to page on. `month`/`day` use plain integer ranges (not `date` projection) so Athena doesn't
   reject the handful of `day=31` values that don't exist in every month; the storage template's
   digit-padding is what keeps the generated keys matching what the Lambda actually writes.

## Shared module extraction

New module: `src/common/modules/gold-export/`
- `gold-export.io.ts` — `loadExport(s3Client, bucket, key)` and `scanDynamoStatus(tableName, dynamoDocClient)`, moved from `src/functions/geojson-emitter/geojson-emitter.ts` (including the `isMissingKeyError`/404-tolerant behavior). `GOLD_EXPORT_KEY` constant lives here too.
- `gold-export.overlay.ts` — `parseStatusItems`, `overlayStatus`, `evseKey`, moved verbatim from `src/functions/geojson-emitter/overlay.ts`.
- `gold-export.types.ts` — `GoldExport`, `GoldLocation`, `GoldEvse`, `GoldConnector`, `GoldTariff*`, `StatusItem`, `StatusByKey`, `OverlayResult`, moved from `src/functions/geojson-emitter/types.ts`. Extend `GoldLocation` here with the new upstream-enriched fields: `country_code` (already present), `canton?: string`, `commune?: string`.

`geojson-emitter.ts`, `overlay.ts` (deleted), `render.ts`, and `types.ts` update their imports to pull from `/opt/nodejs/modules/gold-export/*` instead of local files — no behavior change. Existing `overlay.unit.test.ts` relocates to `tests/unit/common/modules/gold-export/`.

## New Lambda: `src/functions/evse-occupancy-snapshot/`

Same handler/orchestration/pure-logic split this repo already uses in `geojson-emitter`:

- **`evse-occupancy-snapshot.ts`** — thin `handler` (env → clients) + `run(loadExportFn, scanStatusFn, writeParquetFn, runTimestamp)`. `loadExportFn` failure aborts (nothing to snapshot this run). `scanStatusFn` failure is caught/logged and falls back to Gold's baked-in status, same resilience rationale `geojson-emitter` already uses — a run should still record *something* for every EVSE rather than skip the whole 15-min interval.
- **`build-rows.ts`** — pure logic: `buildOccupancyRows(locations: GoldLocation[], runTimestamp: string): OccupancyRow[]`. For each location's EVSEs: classify each connector via the AC/DC lookup, OR them into `ac_compatible`/`dc_compatible`; derive `truck_compatible` from `location.vehicle_types`; copy `country_code`/`canton`/`commune`. An EVSE with zero connectors still emits one row (`ac_compatible = dc_compatible = false`) so every EVSE is represented every interval.
- **`lookups.ts`** — `CONNECTOR_POWER_TYPE: Record<string, 'AC' | 'DC'>` keyed by OCPI `standard` (IEC_62196_T1/T2 → AC; IEC_62196_T2_COMBO/CHADEMO/TESLA_R/TESLA_S/MCS → DC). Kept separate from `geojson-emitter/lookups.ts`'s `CONNECTOR_STANDARD_LABELS` — different purpose (analytics classification vs. display label) despite overlapping keys.
- **`parquet-writer.ts`** — I/O: serializes `OccupancyRow[]` to Parquet and `PutObject`s to `s3://<gold-bucket>/evse_occupancy_snapshot/year=YYYY/month=MM/day=DD/<runTimestamp>.parquet`, mirroring the `year=/month=/day=` convention `buildLandingZoneKey` already uses in `src/common/aws/s3.ts`.
- **`types.ts`** — `OccupancyRow { evse_id, location_id, status, snapshot_ts, country_code, canton, commune, ac_compatible, dc_compatible, truck_compatible }`.

### New dependency
No Parquet library exists in this repo today. Add `@dsnp/parquetjs` (maintained fork of the unmaintained `parquetjs`) to `dependencies` (not `devDependencies` — needed at Lambda runtime, and `scripts/package.sh` ships production deps only).

## Cross-repo / infra prerequisites (not implemented in this repo)

- ~~**Blocking**: Silver→Gold Glue enrichment must add `country_code`/`canton`/`commune` to each
  location object in `gold_location_serving_export/latest.json` before this feature can populate
  those columns.~~ **Done** — see above.
- New Lambda resource `evse-occupancy-snapshot` + new EventBridge rule `rate(15 minutes)` — the
  first scheduled trigger in this system; confirm expected retry/DLQ behavior (a missed run should
  just be logged/skipped, not retried indefinitely — one gap in a 7-day trend chart is acceptable).
- Same env vars as `geojson-emitter` (Gold bucket, cross-account role ARN) — no new IAM beyond what
  `geojson-emitter` already has (S3 read/write on Gold + `dynamodb:Scan` on the status table); no
  Glue/Athena permissions needed since there's no PLZ-table join.
- New Glue Data Catalog table `evse_occupancy_snapshot` with **partition projection** enabled
  (`year=/month=/day=` range projection, see the config above) so Superset can query via Athena
  without this Lambda ever registering partitions at runtime.
- **No compaction path today.** One small Parquet file lands every 15 minutes, forever (indefinite
  retention, decision 8) — ~96 files/day, ~35k/year, with no job in this system that rewrites or
  merges them. `emobility-data-pipelines`' weekly Maintenance job already does this kind of
  small-file/snapshot cleanup for the Iceberg gold tables; once that job (or an equivalent periodic
  `OPTIMIZE`/rewrite step) exists, add `evse_occupancy_snapshot` to its scope so Athena scan
  performance doesn't degrade as the file count grows. Not blocking for the initial rollout, but
  don't forget it once the dashboard is real and being queried regularly.

## Tests to add

Mirroring `tests/unit/functions/geojson-emitter/*`:
- `tests/unit/common/modules/gold-export/gold-export.overlay.unit.test.ts` (relocated, same cases)
- `tests/unit/common/modules/gold-export/gold-export.io.unit.test.ts` — new: 404/NoSuchKey → `null`; other errors propagate; DynamoDB scan pagination via `LastEvaluatedKey`.
- `tests/unit/functions/evse-occupancy-snapshot/build-rows.unit.test.ts` — AC/DC boolean derivation for single/multi/zero-connector EVSEs, truck_compatible derivation, canton/commune pass-through (including `undefined` when the Gold export hasn't been enriched yet).
- `tests/unit/functions/evse-occupancy-snapshot/lookups.unit.test.ts` — connector-standard → AC/DC classification table.
- `tests/unit/functions/evse-occupancy-snapshot/evse-occupancy-snapshot.unit.test.ts` — `run()` orchestration with injected fakes: happy path, DynamoDB scan failure degrades gracefully, Gold export load failure aborts without writing.
- `tests/integration/functions/evse-occupancy-snapshot/evse-occupancy-snapshot.integration.test.ts` — against Ministack: seed a fake Gold export + status table, run the real handler, assert a Parquet object lands at the expected `year=/month=/day=` key with correct row contents (read back with the same Parquet library).

## Verification

1. `yarn build` — TypeScript compiles cleanly after the module extraction and new Lambda.
2. `yarn test:unit` — new and relocated unit tests pass.
3. `yarn test:integration` (Docker/Ministack running) — new integration test confirms a Parquet file is written to the expected partitioned key with correct row contents.
4. Manually invoke the new Lambda locally against Ministack (mirroring `scripts/run_emitter_locally.py`'s intent, adapted to this repo's actual TypeScript Lambdas) and inspect the resulting Parquet file's rows.
5. Confirm with the infra team that the Glue table's partition-projection config resolves the same S3 keys this Lambda writes, and that a manual Athena `SELECT * FROM evse_occupancy_snapshot LIMIT 10` returns rows after a real invocation.