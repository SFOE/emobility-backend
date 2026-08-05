/**
 * Domain types for the Gold Export JSON and the emitter pipeline.
 * These types describe the structure of the data produced by the Gold Glue job
 * and consumed by this emitter to build the swisstopo-consumable GeoJSON.
 */

export interface GoldTariffPriceComponent {
  type: string;
  price: number;
}

export interface GoldTariffElement {
  price_components: GoldTariffPriceComponent[];
}

export interface GoldTariff {
  id?: string;
  currency: string;
  elements: GoldTariffElement[];
}

export interface GoldConnector {
  connector_id?: string;
  standard: string;
  max_electric_power: number;
  tariff_ids?: string[];
}

export interface GoldEvse {
  evse_uid: string;
  evse_id?: string;
  status: string;
  connectors: GoldConnector[];
}

export interface GoldLocation {
  country_code: string;
  party_id: string;
  id: string;
  full_location_id: string;
  latitude: number;
  longitude: number;
  address_display: string;
  operator_name?: string;
  operator_url?: string;
  credit_card_payable?: boolean;
  debit_card_payable?: boolean;
  /** JSON-stringified opening hours object, as stored in the Gold export. */
  opening_hours_json?: string;
  facilities?: string[];
  /** JSON-stringified energy mix object, as stored in the Gold export. */
  energy_mix_json?: string;
  tariffs: GoldTariff[];
  evses: GoldEvse[];
  evse_ids: string[];
}

export interface GoldExport {
  locations: GoldLocation[];
}

/** Parsed structure of opening_hours_json from the Gold export. */
export interface OpeningHours {
  twentyfourseven?: boolean;
  regular_hours?: Array<{ weekday: number; period_begin: string; period_end: string }>;
  exceptional_openings?: Array<{ period_begin: string; period_end: string }>;
  exceptional_closings?: Array<{ period_begin: string; period_end: string }>;
}

/** Parsed structure of energy_mix_json from the Gold export. */
export interface EnergyMix {
  energy_sources?: Array<{ source: string; percentage: number }>;
}

/** One row from the DynamoDB EVSE current-status table. */
export interface StatusItem {
  /** Partition key: LOCATION#country_code#party_id#location_id */
  pk: string;
  /** Sort key: EVSE#evse_uid */
  sk: string;
  status: string;
  last_updated: string;
}

export type StatusByKey = Record<string, { status: string; last_updated: string }>;

// --- GeoJSON output types ---

export interface ConnectorProperties {
  connector_id: string | undefined;
  standard: string;
  standard_label: string;
  max_electric_power: number;
  price: string;
}

export interface EvseProperties {
  evse_id: string | undefined;
  status: string;
  status_label: string;
  connectors: ConnectorProperties[];
}

export interface FeatureProperties {
  location_id: string;
  Availability: string;
  symbology: string;
  description: string;
}

export interface GeoJsonFeature {
  type: 'Feature';
  id: string;
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: FeatureProperties;
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  generated_at: string;
  features: GeoJsonFeature[];
}
