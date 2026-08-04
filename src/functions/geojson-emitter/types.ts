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

/** One row from the DynamoDB EVSE current-status table. */
export interface StatusItem {
  /** Composite key: country_code#party_id#location_id#evse_uid */
  pk: string;
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
  operator: { name?: string; url?: string };
  address: string;
  credit_card_payable: boolean;
  debit_card_payable: boolean;
  opening_hours: unknown;
  facilities: string[];
  energy_mix: unknown;
  tariffs: GoldTariff[];
  evses: EvseProperties[];
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
