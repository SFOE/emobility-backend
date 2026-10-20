import { Aws } from '/opt/nodejs/aws/constants';
import { EVSEStatus } from '/opt/nodejs/modules/ocpi-locations/ocpi-locations.model';

/**
 * The public, read-only OCPI API serves finished OCPI 2.3.0 objects that the
 * Glue silver-to-gold job writes into one DynamoDB table per object type
 * (`emobility-data-pipelines`, docs/schemas.md § DynamoDB — OCPI public API
 * serving tables). This module only reads them.
 */
export interface PublicObjectType {
  // Value of gsi1pk/gsi2pk and the pk prefix, e.g. LOCATION#CH#ABC#LOC-001.
  key: 'LOCATION' | 'TARIFF';
  tableName: string;
  // Public path of the list endpoint, used to build the `Link` header.
  path: '/ocpi/locations' | '/ocpi/tariffs';
  // Used in error messages, e.g. "Location not found".
  label: 'Location' | 'Tariff';
}

export const PUBLIC_LOCATIONS: PublicObjectType = {
  key: 'LOCATION',
  get tableName() {
    return Aws.dynamoDBTables.ocpiLocations;
  },
  path: '/ocpi/locations',
  label: 'Location',
};

export const PUBLIC_TARIFFS: PublicObjectType = {
  key: 'TARIFF',
  get tableName() {
    return Aws.dynamoDBTables.ocpiTariffs;
  },
  path: '/ocpi/tariffs',
  label: 'Tariff',
};

// GSI1: constant gsi1pk per table + numeric seq (type N) -> OCPI offset pagination.
export const OFFSET_INDEX = 'gsi1';
// GSI2 (keys only): constant gsi2pk + `{last_updated}#{pk}` -> OCPI date_from.
export const DATE_FROM_INDEX = 'gsi2';
// Reserved item holding the exact object count of a serving table.
export const META_PK = '#META';

// One serving-table item. `body` is the OCPI object, already serialized.
export interface ServingItem {
  pk: string;
  body: string;
  last_updated: string;
  seq: number;
}

export interface ServingMetaItem {
  pk: typeof META_PK;
  item_count: number;
  generation: string;
  built_at: string;
}

// Item of `ocpi-evse-current-status` (written by the CPO-facing API).
export interface EvseStatusItem {
  pk: string;
  sk: string;
  status: EVSEStatus;
  last_updated: string;
  received_at: string;
}

// Element of `GET /ocpi/status?date_from=`.
export interface PublicEvseStatus {
  country_code: string;
  party_id: string;
  location_id: string;
  evse_uid: string;
  status: EVSEStatus;
  last_updated: string;
}
