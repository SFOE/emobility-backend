# emobility-backend – CLAUDE.md

## Projekt

ITS 2.0 (ich-tanke-strom 2.0) – nationale Ladeinfrastruktur-Datenplattform des BFE Schweiz.
Dieses Repo implementiert das OCPI Backend (AWS Lambda + DynamoDB, TypeScript).
CPOs pushen Ladepunkt-Daten via OCPI; Ausgabe in OCPI + Datex II. Go-Live: Ende 2026.
In diesem Projekt werden nur die OCPI Module: Credentials, Tarrifs und Locations für die OCPI Versionen 2.2.1/2.3.0 implementiert.

Vollständiger Projektkontext: ~/.claude/memory/ocpi/its2_studie.md

## OCPI-Referenz

Konsultiere diese Dateien BEVOR du Annahmen über Protokoll-Verhalten oder Datenstrukturen triffst:
- OCPI Module & Datenstrukturen: ~/.claude/memory/ocpi/

Falls Informationen unvollständig oder nicht ausreichend sind, prüfe die in den jeweiligen
Memory-Dateien verlinkten Quelldokumente.
