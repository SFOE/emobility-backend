# `emitter/` — final GeoJSON emitter

A lightweight, non-Glue emitter (an AWS Lambda) that reads the Gold job's JSON
export from S3, overlays each EVSE's live status from DynamoDB (falling back to
the lakehouse-derived status), and publishes the swisstopo-consumable GeoJSON.
Plain Python 3.11+, `boto3` only — no PySpark/`awsglue` dependency, since this
runs outside Glue. See `.sdd/final-geojson-emitter/requirements.md` for the full
requirements and `docs/architecture.md` for how this fits the overall pipeline.

## Driver / pure-logic split

Same convention this repo already uses for the Glue drivers
(`landing-to-bronze.py` vs. `bronze_to_silver/`, etc.): AWS I/O lives in thin,
untested modules; all decision-making logic lives in pure, unit-tested modules.

| Module | Kind | Tested locally? |
|---|---|---|
| `handler.py::lambda_handler` | AWS-facing driver (real `boto3` clients, env config) | No — thin I/O wiring only, same convention as the Glue drivers |
| `handler.py::run` | Pure orchestration (I/O steps injected as callables) | **Yes** — `tests/test_emitter_pipeline.py` |
| `io_export.py`, `io_status.py`, `io_geojson.py` | AWS I/O (S3 `get_object`/`put_object`, DynamoDB `scan`) | No — thin I/O only |
| `overlay.py` | Pure status overlay | **Yes** — `tests/test_emitter_overlay.py` |
| `lookups.py` | Pure static translation tables | **Yes** — `tests/test_emitter_lookups.py` |
| `render.py` | Pure GeoJSON/HTML rendering | **Yes** — `tests/test_emitter_render.py` |

### Deviation from the requirements' Technical Annex

The Annex states `handler.py` is "not unit tested locally... same as the
existing Glue drivers." In practice this was refined: `handler.py::run()` is a
small, pure orchestration function that takes its I/O steps (`load_export`,
`scan_status`, `write_geojson`) as injected callables, so the pipeline's own
wiring — did it call the overlay before rendering? does a failed export read
abort before any write happens? does a failed status scan still write the
fallback-only GeoJSON? — is testable with plain fakes, no AWS credentials
and no AWS-mocking library (e.g. `moto`). Only the real
`lambda_handler(event, context)` entry point (building real `boto3`
clients/resources from environment config) remains untested, consistent with
the Annex's intent for the *real* AWS-facing driver code.

## Data flow

```
lambda_handler
  -> io_export.load_export        (S3 GetObject)
  -> io_status.scan_dynamo_status (DynamoDB Scan)
  -> overlay.parse_status_items + overlay.overlay_status
  -> render.build_feature_collection
  -> io_geojson.write_geojson     (S3 PutObject)
```

An exception from `load_export` propagates out of `run()` immediately —
`write_geojson` is never called, so a partial or incorrect GeoJSON is never
published (the previously published file is left unchanged). An exception
from `scan_status` does **not** abort the run: `run()` falls back to an empty
status overlay and still calls `write_geojson`, so the GeoJSON gets rewritten
with the export's baked-in fallback status instead of staying frozen at
whatever was last published. This lets Gold's ~15-min cadence keep the map
updated even while DynamoDB (or the emitter's read of it) is down, and lets
the emitter be deployed before DynamoDB/the status API exist at all.

## Running the tests

No AWS credentials, network access, or AWS-mocking library needed:

```bash
pytest tests/test_emitter_overlay.py tests/test_emitter_lookups.py tests/test_emitter_render.py tests/test_emitter_pipeline.py
```

## Running the emitter locally

There is no scheduled/event-driven trigger for this Lambda yet (see the
requirements' Out of Scope section) — `scripts/run_emitter_locally.py` is the
way to invoke it manually during development.

Offline, against the repo's sample fixtures (no AWS credentials or network
access needed):

```bash
python scripts/run_emitter_locally.py
```

This reads `tests/fixtures/sample_gold_export.json` and
`tests/fixtures/sample_dynamo_status_items.json`, and writes the resulting
GeoJSON `FeatureCollection` to `./final_geojson_local_output.json`. Pass
`--export-file` / `--status-file` / `--output-file` to point at different
local files.

Against real or local (e.g. LocalStack) AWS resources, using the same wiring
`lambda_handler` uses:

```bash
TARGET_BUCKET=my-bucket STATUS_TABLE_NAME=my-table \
    python scripts/run_emitter_locally.py --aws
```

See `scripts/run_emitter_locally.py`'s module docstring for the full set of
options and environment variables.