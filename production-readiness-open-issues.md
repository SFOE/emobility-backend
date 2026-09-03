# Production-Readiness — offene Punkte

Ergebnis des Gesamt-Code-Reviews (OCPI Backend). Referenzen als `symbol` / `datei` statt fixer Zeilennummern, da sich diese durch laufende Änderungen verschieben.

Legende: 🟠 HIGH · 🟡 MEDIUM · 🟢 LOW · 🔧 externe Infra · ✅ erledigt · ⚪️ bewusst akzeptiert

---

## ✅ Bereits erledigt

- **BLOCKER — Cross-Tenant-Schreibzugriff:** `assertOwnership` entfernt. Mandanten-Trennung ist bewusst eine Onboarding-Verantwortung (siehe „Akzeptiert").
- **HIGH — `last_updated` numerisch:** `upsertEvseCurrentStatus` speichert/vergleicht jetzt `last_updated_ms` numerisch statt lexikografisch (`ocpi-locations.db.ts`).
- **HIGH — `status`-Enum-Validierung:** `isEVSEStatus`-Guard vor dem Fast-Path-Write (`ocpi-locations.model.ts`, `ocpi-locations-patch-evse.ts`).
- **HIGH — GeoJSON Per-Feature-Isolation:** `buildFeatureCollection` überspringt fehlerhafte Locations statt den ganzen Publish zu brechen (`render.ts`).
- **HIGH — Raw-S3-Key eindeutig:** `putRawToS3` hängt `randomUUID()` an den Key (`s3.ts`).
- **Raw-data-loader (früher):** Batch-Key mit `awsRequestId`, AssumeRole im try, fehlender Gold-Export sauber behandelt, teures Debug-Log entfernt, `raw`-Guard.

---

## 🟠 HIGH — offen

### H1 · Security-Scan-Action auf mutable `@develop` gepinnt
- **Wo:** `.github/workflows/deploy-dev.yml`, `.github/workflows/publish-tag.yml` — `aws-actions/vulnerability-scan-github-action-for-amazon-inspector@develop`
- **Problem:** Das CVE-Gate jedes Deployments läuft mit beliebigem Dev-Branch-Stand einer Third-Party-Action (Supply-Chain-Risiko).
- **Fix:** Auf Release-Tag + Commit-SHA pinnen; per Dependabot aktualisieren.

---

## 🟡 MEDIUM — offen

### M1 · Path-/Body-Identifier ohne Charset-Validierung in S3-/DynamoDB-Keys
- **Wo:** `s3.ts` (`buildS3Key`), Locations/Tariffs PUT/PATCH-Handler, `ocpi-locations.db.ts` (`LOCATION#..` Keys). Nur die Credentials validieren Charset.
- **Problem:** `#`, `=`, Whitespace, url-dekodierte Segmente in `country_code`/`party_id`/`location_id`/`evse_uid`/`connector_id`/`tariff_id` können Athena/Glue-Partitionierung oder DynamoDB-Keys korrumpieren/kollidieren.
- **Fix:** Jeden Path-/Body-Identifier vor Key-Nutzung gegen OCPI CiString (Charset + Länge) validieren.

### M2 · STS AssumeRole pro Invocation, kein Caching
- **Wo:** `s3.ts` (`createCrossAccountS3Client`), genutzt in `ocpi-raw-data-loader.ts` und `geojson-emitter.ts`.
- **Problem:** Jede Invocation ruft `AssumeRole` (Latenz + STS-Throttling-Risiko unter Last; ein Throttle kann den ganzen Loader-Batch retrien → Feedback-Loop).
- **Fix:** Client modulweit cachen (keyed by roleArn, refresh vor Ablauf) oder SDK-`fromTemporaryCredentials`.

### M3 · Voller DynamoDB-Scan pro Emitter-Run
- **Wo:** `geojson-emitter.ts` (`scanDynamoStatus`).
- **Problem:** Bei nationalem Volumen (100k+ EVSEs) teuer/langsam; `last_updated` wird gescannt, aber nie verwendet.
- **Fix:** `ProjectionExpression` auf `pk, sk, status`; ggf. Export/Stream statt Full-Scan pro Run prüfen.

### M4 · `rotateCredentialsToken` nicht atomar
- **Wo:** `ocpi-credentials.db.ts` (`rotateCredentialsToken` — Put neu, dann Delete alt).
- **Problem:** Teil-Fehler lässt alt+neu gültig oder halb-rotiert (Secret schon rotiert, DynamoDB halb).
- **Fix:** `TransactWriteItems` (create + delete in einer Transaktion) oder idempotent/reconcilable machen.

### M5 · Heiße GSI-Partition
- **Wo:** `ocpi-locations.db.ts` — GSI1-PK ist konstant `'EVSE_STATUS'` für alle Items.
- **Problem:** Throughput-Konzentration + 10-GB-Partitions-Limit bei hoher Status-Frequenz.
- **Fix:** GSI-PK sharden (z.B. nach country/party oder Hash-Bucket) oder Notwendigkeit des globalen zeitsortierten GSI prüfen.

### M6 · Ineffektives `overrides` + stale CVE-Suppression
- **Wo:** `package.json` (`overrides` unter Yarn Classic ist no-op → `resolutions`), `.inspector-ignore` (Suppression für `fast-xml-parser`, das nicht mehr im Lockfile ist).
- **Fix:** `overrides` → `resolutions` (falls noch nötig); veraltete Suppression + Override entfernen.

### M7 · `getItem` mis-typed + Fehlerursache verworfen
- **Wo:** `dynamodb.ts` (`getItem` gibt `Item as T` auch bei Miss zurück; Wrapper werfen generische Errors ohne `cause`).
- **Problem:** Caller behandelt fehlendes Item als vorhandenes `T` → `TypeError` fern der Ursache; Triage verliert SDK-Fehlertyp (Throttling/Validation/AccessDenied).
- **Fix:** `getItem` → `T | null`; Wrapper mit `{ cause: err }` rethrowen.

---

## 🟢 LOW — offen

- **Authorizer loggt Token-Präfix** (`ocpi-authorizer.ts`, `token.slice(0,8)`) → Hash/Länge statt Token-Bytes loggen.
- **`response.Body!` Non-null-Assertions** (`s3.ts` `getRawFromS3`, `geojson-emitter.ts` `loadExport`) → expliziter Guard mit Bucket/Key im Fehler.
- **`writeGeoJson` 4-Sprachen nicht atomar** (`geojson-emitter.ts`, `Promise.all`) → Teilausfall lässt gemischte Sprachstände; per-File tolerieren/retrien (Rerun ist idempotent).
- **`buildObjectId` ohne `default`/Guard** (`sqs.ts`) → bei fehlender ID entsteht `"undefined"` im `object_id`; `default`-Throw + Pflichtfeld-Check.
- **Emitter ohne Concurrency-Guard** → Reserved Concurrency = 1 (sonst überlappen Scans/Writes bei häufigem Schedule).
- **Keine expliziten SDK-Timeouts** (S3/SQS/DynamoDB Clients) → `connectionTimeout`/`requestTimeout` via `NodeHttpHandler`, damit ein hängender Connect nicht das ganze Lambda-Timeout frisst.
- **`.nvmrc` (v24) vs CI/`engines` (22)** → angleichen.
- **Lint-Scope** deckt `tests/` und `scripts/` nicht ab (`"lint": "eslint src"`).
- **GitHub Actions auf floating Major-Tags** (`@v5`/`@v7`/…) → SHA-pinnen (Dependabot).
- **`invalidateBootstrapToken` unconditional UpdateItem** (aktuell ungenutzt) → `attribute_exists(pk)`-Guard, falls reaktiviert.
- **Prod-Bootstrap-Token im Klartext auf Dev-Disk** (`scripts/prod-bootstrap-token.txt`, korrekt gitignored/uncommitted) → als Secret behandeln (Secrets Manager / One-Time-Delivery), rotieren falls geteilt.

---

## 🔧 Externe Infra — verifizieren (liegt im `prometheon-emobility-*` Terraform-Repo, nicht hier)

- **`ReportBatchItemFailures`** muss am SQS-Event-Source-Mapping des raw-data-loader aktiv sein — sonst löscht SQS trotz `batchItemFailures` den ganzen Batch → stiller Datenverlust.
- **DLQ + `maxReceiveCount`** vorhanden, und **Raw-Bucket-Retention > max. Retry-Fenster** — sonst gehen Poison-Messages (404 auf Raw-Objekt) verloren. Alarm auf DLQ-Tiefe.
- **API-Gateway-Authorizer-Result-Caching-TTL** prüfen — darf keinen Context über verschiedene Tokens cachen.

---

## ⚪️ Bewusst akzeptiert (dokumentierte Entscheidungen)

- **Mandanten-Isolation via Onboarding:** kein Per-Request-Ownership-Check auf den Write-Handlern. `roles[]` werden beim Onboarding selbst deklariert; die Vertrauensgrenze liegt am überwachten Onboarding (nur ausgewählte CPOs erhalten den Bootstrap-Token, der danach invalidiert wird). Kein Re-Introduzieren des Checks vorschlagen.
- **Duplikate in der Landing Zone bei SQS-Retry:** akzeptiert — die Bronze-ETL dedupliziert per Record-Identität.
