# emobility-backend – CLAUDE.md

## Projekt

ITS 2.0 (ich-tanke-strom 2.0) - nationale Ladeinfrastruktur-Datenplattform des BFE Schweiz und NAP (National Access Point). Dieses Repo implementiert das OCPI Backend (AWS Lambda, AWS API-Gateway + AWS DynamoDB, TypeScript). CPOs pushen Daten via OCPI in dieses Backend (Verarbeitung) → Weiterlieferung an ein BFE-Cloud Data Lakehouse (Historisierung) → Ausgabe via OCPI-API, Datex II, Swisstopo und Apache Superset (Visualisierungen). In diesem Projekt werden nur die OCPI Module: Credentials, Tariffs und Locations für die OCPI Versionen 2.2.1/2.3.0 implementiert. Konsultiere diese Datei bevor du Annahmen über den Projektkontext triffst: ~/.claude/memory/ocpi/its2_studie.md.

## OCPI-Referenz

Konsultiere diese Dateien BEVOR du Annahmen über Protokoll-Verhalten oder Datenstrukturen triffst. Bei unvollständigen Informationen: Quelldokumente sind in den Memory-Dateien verlinkt. Keine OCPI-Datenstrukturen erfinden – immer ~/.claude/memory/ocpi/ prüfen.

## Development

| Command | Zweck |
|---------|-------|
| `yarn build` | TypeScript kompilieren |
| `yarn test:unit` | Unit Tests ausführen |
| `yarn test:integration` | Integration Tests ausführen |
| `yarn prettier --write <path>` | Datei formatieren auf die geänderten Dateien anwenden |

## Architektur & Konventionen

**Schichten**
`functions/` (Lambda Handler) → `common/modules/` (Business/DB-Layer) → `common/aws/` (AWS)

**`src/common/`**
- `aws/` – Generische AWS CRUD-Funktionen und Clients; keine Business-Logik
- `api/` – Gemeinsame OCPI-Protokoll-Typen und Error-Handling
- `modules/<modul>/` – Modulspezifische OCPI-Typen, DynamoDB-Operationen und modulspezifische Transformationen
- `utils/` – Modulübergreifende OCPI-Logik: Guards, Request-Parsing, Token-Extraktion, Response-Building
- `config.constants.ts` – Env-Variablen und Konstanten (nicht AWS spezifisch)

**Regeln:**
- Handler sind schlank: Validierung → `common/`-Aufruf → AWS-Ressourcen (DynamoDB, S3, SQS via `common/aws/`) → `OcpiResponse` zurückgeben
- AWS-Zugriff ausschliesslich über `src/common/aws/` (nie direkt in Handlern oder Modulen)
- OCPI Modulspezifische Logik → `modules/<modul>/`, modulübergreifend → `utils/`

**Tests (`tests/`)**
- `unit/` – Unit Tests für einzelne Funktionen (gemockte Dependencies, spiegeln `src/`-Struktur)
- `integration/` – Tests gegen gemockte lokale AWS Services mit Ministack; Docker muss dafür aktiv sein
- `shared/fixtures/` – DynamoDB Setup/Teardown pro Test; `shared/test-data/` – Vordefinierte Testdaten

**Unit Test Scope:**
- Handler-Tests testen nur Handler-eigene Orchestrierungslogik (alle Imports gemockt); Guards/Utils erhalten eigene Test-Dateien
- Middleware-Guards (via `withVersionCheck`) gehören nicht in Handler-Tests; inline aufgerufene Funktionen werden über Mock-Rückgabewerte geprüft

