# eMobility Backend

OCPI backend of _ich-tanke-strom_ (ITS 2.0), the Swiss national access point (NAP) for
charging infrastructure data run by the Swiss Federal Office of Energy (BFE). AWS Lambda
functions written in TypeScript behind an API Gateway HTTP API, with DynamoDB, S3 and SQS.

- **CPO-facing OCPI API** (`/ocpi/{version}/…`, OCPI 2.2.1 and 2.3.0): charge point
  operators register via `credentials` and push `locations` (incl. EVSEs and connectors)
  and `tariffs`. Every push is stored as raw data and handed to the data lakehouse
  (`emobility-data-pipelines`). EVSE status is also written straight to DynamoDB.
- **Public read-only OCPI API** (`/ocpi/locations`, `/ocpi/tariffs`, `/ocpi/status`, no
  authentication): serves the aggregated data to data consumers as OCPI 2.3.0.
- **GeoJSON emitter**: publishes the map data for swisstopo.

Infrastructure (Lambdas, API Gateway, DynamoDB tables, CloudFront/WAF) is defined in the
`prometheon-emobility-<env>` Terraform repositories.

## Architecture

```
CPO ──PUT/PATCH/DELETE /ocpi/{version}/…──▶ Lambda ──▶ S3 raw data ──▶ SQS ──▶ raw-data-loader ──▶ lakehouse landing zone
                                               └──▶ DynamoDB ocpi-evse-current-status (live EVSE status)

lakehouse (Glue, a few times a day) ──▶ DynamoDB ocpi-locations / ocpi-tariffs (finished OCPI 2.3.0 objects)
                                    └──▶ Gold JSON export (S3) ──▶ geojson-emitter (+ live status) ──▶ swisstopo GeoJSON

data consumer ──GET /ocpi/locations|tariffs|status──▶ CloudFront ──▶ Lambda ──▶ DynamoDB
```

### Endpoints

**CPO-facing** (`/ocpi/{version}/…`, OCPI token via the Lambda authorizer):

| Module        | Methods                                                |
| ------------- | ------------------------------------------------------ |
| `versions`    | `GET /ocpi/versions`, `GET /ocpi/{version}` (no token) |
| `credentials` | `POST`, `GET`, `PUT`, `DELETE`                         |
| `locations`   | `PUT`, `PATCH` for location, EVSE and connector        |
| `tariffs`     | `PUT`, `DELETE`                                        |

**Public** (no authentication, no version segment):

| Route                                                                       | Data                                                                                                 |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `GET /ocpi/locations?offset=&limit=&date_from=`                             | Published locations with EVSEs and connectors; `limit` 1–1000                                        |
| `GET /ocpi/locations/{country_code}/{party_id}/{location_id}`               | One location, else 404 / `2003`                                                                      |
| `GET /ocpi/tariffs?offset=&limit=&date_from=`                               | Valid (not deleted, not expired) tariffs; `limit` 1–1000                                             |
| `GET /ocpi/tariffs/{country_code}/{party_id}/{tariff_id}`                   | One tariff, else 404 / `2003`                                                                        |
| `GET /ocpi/status?date_from=&limit=`                                        | Live statuses received since `date_from`, oldest first; `limit` 1–5000 (default 5000), not paginated |
| `GET /ocpi/status/{country_code}/{party_id}/{location_id}/evses/{evse_uid}` | `{status, last_updated}` of one EVSE                                                                 |

Lists use OCPI pagination: `offset`/`limit`, `Link: <…>; rel="next"`, `X-Total-Count`,
`X-Limit`. `date_from` filters on `last_updated`. The location and tariff objects are
written by the Glue job; this repository only reads them. Their DynamoDB layout (GSI1 for
offset paging, GSI2 for `date_from`) is documented in `emobility-data-pipelines`
(`docs/schemas.md`). The consumer documentation is BFE's "Anleitung zum Datenbezug
«Ich tanke Strom»".

## Project structure

```
src/
├── functions/                    # Lambda handlers (thin: validate → common → response)
│   ├── api/ocpi/                 # CPO-facing OCPI API + authorizer
│   ├── api/public/               # public read-only API (locations, tariffs, status)
│   ├── geojson-emitter/          # swisstopo GeoJSON publication
│   └── raw-data-loader/          # SQS → lakehouse landing zone
└── common/                       # shipped as Lambda layer, imported as /opt/nodejs/*
    ├── api/                      # OCPI response/error types
    ├── aws/                      # generic AWS clients and CRUD (DynamoDB, S3, SQS, …)
    ├── modules/<module>/         # module-specific OCPI types, DB access, transformations
    └── utils/                    # cross-module OCPI logic (guards, parsing, responses)
tests/
├── unit/                         # mirrors src/, dependencies mocked
├── integration/                  # against local AWS services (Ministack, needs Docker)
└── shared/                       # fixtures and test data
```

Conventions (layering, test scope) are described in `CLAUDE.md`.

## Development

Requires Node.js 22 or newer (`.nvmrc`) and Yarn.

```bash
yarn install
yarn build              # TypeScript compile to dist/
yarn lint               # ESLint
yarn test:unit          # unit tests
yarn test:integration   # integration tests; starts Ministack via Testcontainers, Docker must run
yarn prettier --write <path>
```

`yarn package` builds the deployment artifacts: `dist/emobility-backend.zip` (Lambda
functions), `dist/common-layer.zip` and `dist/node-modules-layer.zip` (Lambda layers).

Lambda configuration comes from environment variables set by Terraform, e.g. `BASE_URL`,
`RAW_DATA_BUCKET_NAME`, `INGESTION_QUEUE_URL`, `DATA_LAKE_HOUSE_LANDING_ZONE_BUCKET_NAME`,
`CROSS_ACCOUNT_ROLE_LANDING_ZONE_ARN`. DynamoDB table names are constants in
`src/common/aws/constants.ts`.

## Releases and deployment

Versions are created automatically by [semantic-release](https://semantic-release.gitbook.io/)
from the commit messages on `main`:

- PRs are squash-merged, so the **PR title becomes the commit message** and must be a
  [Conventional Commit](https://www.conventionalcommits.org/) (checked by `pr-title.yml`).
- `feat:` → minor; `fix:`, `perf:`, `refactor:`, `revert:`, `chore(deps):` → patch;
  `feat!:` or a `BREAKING CHANGE:` footer → major; `docs:`, `ci:`, other `chore:`,
  `test:`, `style:`, `build:` → no release.
- `release.yml` tags the version (no `v` prefix, e.g. `1.2.0`), creates a GitHub release
  with notes, commits the same notes to `CHANGELOG.md` (`chore(release): … [skip ci]`) and
  deploys it to **dev**, then **test**, automatically. Prod stays manual.

| Workflow                 | Trigger                        | Purpose                                                                                                                 |
| ------------------------ | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Build & Test             | PRs and pushes to `main`       | Build, lint, unit tests                                                                                                 |
| PR Title                 | PRs                            | Conventional Commit title                                                                                               |
| Release                  | push to `main`                 | semantic-release + `CHANGELOG.md`, then Publish & Deploy to dev, then test                                              |
| Publish & Deploy Tag     | manual                         | Promote a tag to an environment (prod; or redeploy dev/test)                                                            |
| Publish Tag / Deploy Tag | manual, or called by the above | Upload the artifacts to the environment's S3 artifact store / set `backend_app_version` in `prometheon-emobility-<env>` |
| Deploy Dev               | manual                         | Deploy the current branch HEAD (by SHA) to dev for testing                                                              |

Deploying means committing the new `backend_app_version` to the environment's Terraform
repository, whose pipeline then applies it.
