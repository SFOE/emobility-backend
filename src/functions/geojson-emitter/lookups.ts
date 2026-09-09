/**
 * Machine-facing, language-INDEPENDENT lookup tables and constants.
 *
 * User-facing text (labels, fallbacks, units like "Min"/"Ladung", weekday and
 * facility/vehicle labels, status labels) lives in translations.ts and is keyed
 * by language. The values here must stay stable across all languages because
 * they drive styling / are standard identifiers (CSS classes, the `symbology`
 * key, OCPI connector codes, the `kWh` unit and the currency).
 */

export const STATUS_CATEGORY_MAP: Record<string, string> = {
  AVAILABLE: 'AVAILABLE',
  CHARGING: 'CHARGING',
  RESERVED: 'RESERVED',
  UNKNOWN: 'UNKNOWN',
  PLANNED: 'OUTOFORDER',
  BLOCKED: 'OUTOFORDER',
  INOPERATIVE: 'OUTOFORDER',
  OUTOFORDER: 'OUTOFORDER',
  REMOVED: 'OUTOFORDER',
};

// EVSE status category -> CSS class used in the popup (styling key, not shown).
export const STATUS_CSS_CLASS: Record<string, string> = {
  AVAILABLE: 'available',
  CHARGING: 'charging',
  RESERVED: 'reserved',
  UNKNOWN: 'unknown',
  OUTOFORDER: 'outoforder',
};

// ENERGY price component unit — universal, not translated.
export const ENERGY_UNIT = 'kWh';

export const PRICE_COMPONENT_ORDER = ['ENERGY', 'FLAT', 'PARKING_TIME', 'TIME'];

export const AD_HOC_PAYMENT_TARIFF_TYPE = 'AD_HOC_PAYMENT';

export const PRICE_CURRENCY_FALLBACK = 'CHF';

// Human-readable connector-type labels. OCPI `standard` codes are cryptic for
// end users; map the common ones. Anything not listed keeps its OCPI code.
// These are standard/brand names and are identical across languages.
export const CONNECTOR_STANDARD_LABELS: Record<string, string> = {
  IEC_62196_T1: 'Type 1',
  IEC_62196_T2: 'Type 2',
  IEC_62196_T2_COMBO: 'CCS',
  CHADEMO: 'CHAdeMO',
  TESLA_R: 'Tesla',
  TESLA_S: 'Tesla',
};

export const RENEWABLE_ENERGY_SOURCE_CATEGORIES = new Set([
  'GENERAL_GREEN',
  'SOLAR',
  'WIND',
  'WATER',
]);
