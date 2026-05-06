# Data Pipeline: OICP/OCPI Endpunkte → Data Lakehouse

## Kontext

ITS 2.0 empfängt Ladepunkt-Daten von CPOs über OCPI- und OICP-Endpunkte. Diese Daten müssen
zuverlässig in ein Data Lakehouse (Bronze-Schicht) überführt werden, bevor sie für Analysen,
Visualisierungen und Drittanbieter-APIs weiterverarbeitet werden.

Der Tariff-Endpunkt ([`src/functions/api/ocpi/tarrifs/ocpi-tarrifs-put.ts`](../../src/functions/api/ocpi/tarrifs/ocpi-tarrifs-put.ts))
enthält bereits einen Placeholder für diese Integration:

```typescript
// Data Lakehouse connection not yet available — tariff received and acknowledged
console.info(`[OCPI][tarrifs/put] Received tariff ...`);
```

---

## Architektur-Übersicht

```
                        PUT /ocpi/tariffs
  +-------+             PUT /oicp/evse-data              +---------------------------+
  |  CPO  | -----------------------------------------> | Lambda: OCPI/OICP Endpunkt |
  +-------+                                             +---------------------------+
                                                           |                  |
                              1. Rohdaten schreiben        |                  | 2. Metadaten publizieren
                                                           v                  v
                                              +--------------------+   +----------------------+
                                              | S3: Rohdaten-Bucket|   | SQS: Ingestion Queue |
                                              |--------------------|   |----------------------|
                                              | raw/               |   | bucket, key, type,   |
                                              |  tariffs/          |   | timestamp, party_id  |
                                              |   year=2026/       |   +----------------------+
                                              |    {id}.json       |          |         |
                                              +--------------------+          |         |
                                                        ^      Event Trigger  |         | Bei Fehler
                                                        |                     v         v
                                          Rohdaten lesen|          +----------------+  +-----+
                                                        |          | Lambda: Loader |  | DLQ |
                                                        +--------- +----------------+  +-----+
                                                                            |               |
                                                              Transformiert |               | Alarm
                                                                            v               v
                                                          +-------------------------+  +-----------+
                                                          | S3: Lakehouse           |  | CloudWatch|
                                                          | Bronze-Bucket           |  | Alarm     |
                                                          |-------------------------|  +-----------+
                                                          | type=tariff/            |
                                                          |  year=2026/month=05/    |
                                                          |   part-0001.parquet     |
                                                          +-------------------------+
```

---

## Muster-Einordnung

Das Vorgehen kombiniert drei etablierte Enterprise-Patterns:

| Pattern | Beschreibung |
|---|---|
| **Medallion Architecture** | Bronze-Schicht speichert Rohdaten as-is; Silver/Gold veredeln weiter |
| **Transactional Outbox** | Erst persistent speichern, dann Event publizieren — nie umgekehrt |
| **Decoupled Ingestion Pipeline** | Empfang und Verarbeitung sind vollständig entkoppelt über SQS |

Dies ist ein **bewährtes AWS-natives Pattern** (verwendet u.a. von AWS selbst in Lake Formation-Referenzarchitekturen).

---

## Warum diese Architektur?

### Durability-first

Rohdaten landen zuerst in S3, bevor das Event publiziert wird. Selbst wenn das Lakehouse
ausfällt, sind alle Eingangsdaten sicher gespeichert. Der Loader kann später re-triggered werden.

### Fehlertoleranz durch Entkopplung

Der OCPI/OICP-Endpunkt hat **keine direkte Abhängigkeit** zum Data Lakehouse. Ein Ausfall
des Loaders blockiert keine CPO-Verbindungen. Die SQS-Queue puffert die Last automatisch
(Backpressure).

### Replay-Fähigkeit

Da die Rohdaten unveränderlich in S3 liegen, können sie bei Schema-Änderungen oder Bugs im
Loader vollständig re-prozessiert werden — ohne erneute Anfragen an die CPOs.

### Audit Trail

Der Rohdaten-Bucket ist ein vollständiges, unveränderliches Protokoll aller eingegangenen Daten.
Relevant für Compliance (EMBAG: Open Government Data, AFIR: Ladedaten-Transparenz).

### Schema Evolution

Rohdaten bleiben im Originalformat (OICP/OCPI JSON). Transformationen und Schema-Anpassungen
finden ausschliesslich im Loader statt — der Endpunkt muss nicht angepasst werden.

### Observability

Die SQS-Queue-Tiefe ist ein natürlicher Gesundheitsindikator:
- Tiefe steigt → Loader läuft nicht oder zu langsam
- DLQ erhält Nachrichten → Transformationsfehler → Alarm

### Kosten

S3 als Zwischenspeicher ist kostengünstig. Lambda Loader skaliert nur bei Bedarf (event-driven,
kein Idle-Cost).

---

## Ablauf im Detail

### Schritt 1: Endpunkt empfängt Daten

```
CPO → PUT /ocpi/2.3.0/tariffs/{country_code}/{party_id}/{tariff_id}
    Authorization: Token {TOKEN_C}
```

Der Lambda-Handler validiert den Request (Guards: Authentifizierung, Rolle, Ownership),
parst den Body und schreibt dann:

### Schritt 2: Rohdaten in S3 (Rohdaten-Bucket)

```
s3://its2-raw-data/
  tariffs/
    year=2026/month=05/day=06/
      CH_EBP_tariff-001_PUT_20260506T143022Z.json
```

**Key-Format:** `{type}/year={YYYY}/month={MM}/day={DD}/{country_code}_{party_id}_{object_id}_{action}_{timestamp}.json`

Inhalt: unverändertes JSON-Payload wie vom CPO gesendet.

#### Warum dieses Format?

Das Format folgt der **Hive Partition Convention** (`year=`, `month=`, `day=`), die von AWS Athena
und Glue nativ erkannt wird:

```sql
SELECT * FROM raw_tariffs
WHERE year = '2026' AND month = '05'
-- Scannt nur den entsprechenden Ordner, nicht den gesamten Bucket
```

| Bestandteil | Vorteil |
|---|---|
| `{type}/` als Top-Level | Alle OCPI-Module im selben Bucket sauber trennbar |
| `year=/month=/day=` | Hive-kompatibel → Athena/Glue erkennen Partitionen automatisch |
| `{country_code}_{party_id}` im Dateinamen | CPO-Herkunft ohne Datei öffnen erkennbar |
| `{action}` im Dateinamen | PUT vs. DELETE ohne Datei öffnen erkennbar |
| ISO-Timestamp | Chronologische Sortierung via S3 List Objects |
| Timestamp je Event | Kein Überschreiben – jedes Event bekommt eine eigene Datei, Audit Trail bleibt vollständig |

**Hinweis:** Bei hochfrequenten Updates (z.B. EVSE-Status alle paar Sekunden) entstehen viele kleine
Dateien. Im Rohdaten-Bucket ist das erwünscht (vollständiger Audit Trail). Im Bronze-Layer sollte
der Lambda Loader diese Files zu grösseren Parquet-Files zusammenfassen (Compaction).

### Schritt 3: Metadaten in SQS

```json
{
  "action": "PUT",
  "type": "tariffs",
  "object_id": "tariff-001",
  "country_code": "CH",
  "party_id": "EBP",
  "ocpi_version": "2.3.0",
  "received_at": "2026-05-06T14:30:22Z",
  "raw": {
    "bucket": "its2-raw-data",
    "key": "tariff/year=2026/month=05/day=06/CH_EBP_tariff-001_PUT_20260506T143022Z.json"
  }
}
```

### Schritt 4: Lambda Loader (SQS-triggered)

1. Liest Metadaten aus SQS-Event
2. Lädt Rohdaten aus S3 (`GetObject`)
3. Validiert / transformiert in Lakehouse-Schema
4. Schreibt in Bronze-Bucket (partitioniert, ggf. Parquet/JSON Lines)
5. SQS-Nachricht wird automatisch gelöscht bei Erfolg

---

## Einbindung ins bestehende Projekt

### Lambda Layer für S3/SQS Clients

Die bestehende Schicht `src/common/` enthält bereits generische DB-Utilities
([`src/common/db/db-requests.ts`](../../src/common/db/db-requests.ts)).
Analog dazu werden S3- und SQS-Clients als gemeinsame Utilities implementiert:

```
src/common/
  storage/
    s3-client.ts          # S3 PutObject / GetObject
    sqs-client.ts         # SQS SendMessage
```

### Endpunkt-Integration

Im Tariff-Handler wird der Placeholder durch zwei Aufrufe ersetzt:

```typescript
// 1. Rohdaten in S3
await putRawData(tariff, { type: 'tariff', party_id: authContext.partnerId });

// 2. Metadaten in SQS
await publishIngestionEvent({ type: 'tariff', key: s3Key, party_id: authContext.partnerId });
```

---

## Verbesserungsvorschläge

### 1. S3 Event Notifications (Alternative zum manuellen SQS-Write)

S3 kann bei `s3:ObjectCreated:*` automatisch eine SQS-Nachricht auslösen — ohne expliziten
`SendMessage`-Call im Endpunkt.

**Vorteil:** Weniger Code, atomares Verhalten (kein Split-Brain zwischen S3-Write und SQS-Publish).
**Nachteil:** Das SQS-Event enthält nur S3-Metadaten (Bucket, Key, Size) — keine fachlichen Felder
wie `party_id`, `ocpi_version` oder `type`. Der Loader müsste diese aus dem Key-Pfad ableiten.

**Empfehlung:** Den manuellen SQS-Write beibehalten, um fachliche Metadaten direkt mitzuliefern.

### 2. Dead Letter Queue (DLQ)

Fehlgeschlagene Loader-Verarbeitungen (z.B. Parse-Fehler, Schema-Verletzung) dürfen nicht
still verworfen werden. Eine DLQ fängt diese Nachrichten auf:

```
SQS Ingestion Queue
  → maxReceiveCount: 3
  → DLQ: its2-ingestion-dlq
       → CloudWatch Alarm bei queue depth > 0
```

### 3. S3 Object Lock (WORM) für den Rohdaten-Bucket

Write Once Read Many verhindert versehentliches oder böswilliges Überschreiben von Rohdaten.
Relevant für EMBAG-Compliance (Nachvollziehbarkeit öffentlicher Daten).

```
S3 Bucket: its2-raw-data
  ObjectLockConfiguration:
    ObjectLockEnabled: Enabled
    Rule.DefaultRetention:
      Mode: GOVERNANCE
      Days: 3650  # 10 Jahre Aufbewahrung
```

### 4. Idempotenz-Keys gegen Doppelverarbeitung

SQS kann Nachrichten unter bestimmten Bedingungen mehrfach liefern (at-least-once delivery).
Der Loader sollte idempotent sein:

- **Option A:** FIFO-Queue mit `MessageDeduplicationId = sha256(bucket + key)`
- **Option B:** DynamoDB-Tabelle als Idempotenz-Register (bereits bekanntes Pattern im Projekt)

### 5. Partitionierungs-Strategie im Bronze-Layer

```
s3://its2-lakehouse-bronze/
  type=tariff/
    year=2026/month=05/day=06/
      part-0001.parquet
  type=location/
    year=2026/month=05/day=06/
      part-0001.parquet
```

Diese Partitionierung ermöglicht effizienten Zugriff via AWS Athena oder Glue ohne
Full-Table-Scans.

### 6. Format im Bronze-Layer

| Stufe | Format | Begründung |
|---|---|---|
| Rohdaten-Bucket | JSON (original) | Unverändertes Payload, maximale Kompatibilität |
| Bronze-Layer | Parquet (komprimiert) | Spaltenorientiert, günstige Athena-Queries, Glue-kompatibel |

Für den Übergang kann JSON Lines (`ndjson`) als Zwischenlösung verwendet werden, da kein
Schema vorab definiert werden muss.

---

## Zusammenfassung

Das gewählte Vorgehen (S3 Rohdaten → SQS Metadaten → Lambda Loader → Bronze S3) ist ein
solides, cloud-natives Pattern für zuverlässige Daten-Ingestion. Die wichtigsten Stärken:

- Rohdaten gehen nie verloren, auch bei Downstream-Ausfällen
- Vollständiger Audit Trail für Compliance
- Entkopplung erlaubt unabhängige Weiterentwicklung von Endpunkten und Loader
- Replay bei Schema-Änderungen ohne erneute CPO-Kommunikation

Die grössten Risiken ohne die vorgeschlagenen Verbesserungen sind:
1. Kein DLQ → fehlgeschlagene Loader-Events werden still verworfen
2. Keine Idempotenz → Doppelverarbeitung bei SQS-Redelivery möglich
3. Flache S3-Struktur → teure Athena-Full-Scans ohne Partitionierung

---

## Offene Fragen

### DELETE-Behandlung: Nur SQS oder Tombstone in S3?

Bei einem DELETE-Request gibt es keinen Body — es stellt sich die Frage, ob das Ereignis
nur über SQS weitergeleitet wird oder ob zusätzlich ein Tombstone-Objekt im Rohdaten-Bucket
abgelegt werden soll.

**Option A – Nur SQS (kein S3-Objekt):**
Einfacher, aber SQS-Nachrichten existieren maximal 14 Tage. Fällt der Loader in dieser Zeit
aus, ist das DELETE-Ereignis spurlos verschwunden — kein Replay möglich.

**Option B – Tombstone in S3:**
Das DELETE wird als eigenes Objekt im Rohdaten-Bucket persistiert (z.B.
`CH_EBP_tariff-001_DELETE_20260506T160000Z.json`). Audit Trail bleibt vollständig,
Replay ist jederzeit möglich. Relevant für EMBAG-Compliance.

> Entscheidung offen: Welche Variante wird umgesetzt?
