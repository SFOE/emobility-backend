# Changelog

## [1.4.0](https://github.com/SFOE/emobility-backend/compare/1.3.0...1.4.0) (2026-11-25)

### Features

* **monitoring:** require the BFE staff group for GET /monitoring/cpos ([#73](https://github.com/SFOE/emobility-backend/issues/73)) ([97df78a](https://github.com/SFOE/emobility-backend/commit/97df78a5d52e85087e4e5b58dca0f3e8b4adcd88)), closes [SFOE-prometheon/prometheon-cognito#70](https://github.com/SFOE-prometheon/prometheon-cognito/issues/70)

## [1.3.0](https://github.com/SFOE/emobility-backend/compare/1.2.0...1.3.0) (2026-11-20)

### Features

* send GeoJSON popup feedback by e-mail instead of the uvek-gis form ([#72](https://github.com/SFOE/emobility-backend/issues/72)) ([33eea15](https://github.com/SFOE/emobility-backend/commit/33eea152dee27f6ac4932be1791759280c5313d7))

## [1.2.0](https://github.com/SFOE/emobility-backend/compare/1.1.1...1.2.0) (2026-11-17)

### Features

* pass the OCPI versions per CPO through GET /monitoring/cpos ([#71](https://github.com/SFOE/emobility-backend/issues/71)) ([e0e5f53](https://github.com/SFOE/emobility-backend/commit/e0e5f53fbdd6eb6a1b41931fb678c5019a235ddf))

## [1.1.1](https://github.com/SFOE/emobility-backend/compare/1.1.0...1.1.1) (2026-11-16)

### Bug Fixes

* **ci:** make deploy.auto.tfvars version update whitespace-tolerant ([#69](https://github.com/SFOE/emobility-backend/issues/69)) ([136a069](https://github.com/SFOE/emobility-backend/commit/136a069b845ae578870b246bbc4bb67e64399706))

## [1.1.0](https://github.com/SFOE/emobility-backend/compare/1.0.0...1.1.0) (2026-11-16)

### Features

* show the suboperator as operator in the GeoJSON popup ([#68](https://github.com/SFOE/emobility-backend/issues/68)) ([7e173bc](https://github.com/SFOE/emobility-backend/commit/7e173bca3a912832b9626cf898f1368811fb3294)), closes [SFOE/emobility-data-pipelines#74](https://github.com/SFOE/emobility-data-pipelines/issues/74)

## [1.0.0](https://github.com/SFOE/emobility-backend/compare/0.9.0...1.0.0) (2026-11-13)

### ⚠ BREAKING CHANGES

* add GET /monitoring/cpos for the E-Mobility Monitoring page (#66)

### Features

* add GET /monitoring/cpos for the E-Mobility Monitoring page ([#66](https://github.com/SFOE/emobility-backend/issues/66)) ([9ff7653](https://github.com/SFOE/emobility-backend/commit/9ff76535b6f44774b09d4fb23dffb9cb4b3a7dc0))
