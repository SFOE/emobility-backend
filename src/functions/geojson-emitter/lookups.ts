/**
 * Static OCPI-to-display-label translation tables and shared placeholder constants.
 *
 * Kept separate from render.ts so a translation can be corrected without
 * touching rendering code once compared against real production samples.
 */

/** Maps OCPI EVSE status to [cssClass, humanLabel]. */
export const STATUS_CLASS_LABELS: Record<string, [string, string]> = {
  AVAILABLE: ['available', 'Verfügbar'],
  CHARGING: ['occupied', 'Besetzt'],
  RESERVED: ['reserved', 'Reserviert'],
  PLANNED: ['planned', 'Geplant'],
  UNKNOWN: ['unknown', 'Verfügbarkeit unbekannt'],
  BLOCKED: ['blocked', 'Blockiert'],
  INOPERATIVE: ['inoperativ', 'Temporär Ausser Betrieb'],
  OUTOFORDER: ['outofservice', 'Ausser Betrieb'],
};

export const CONNECTOR_STANDARD_LABELS: Record<string, string> = {
  IEC_62196_T1: 'Typ 1',
  IEC_62196_T2: 'Typ 2',
  IEC_62196_T2_COMBO: 'CCS',
  CHADEMO: 'CHAdeMO',
  DOMESTIC_F: 'Schuko',
  TESLA_R: 'Tesla',
};

export const FACILITY_LABELS: Record<string, string> = {
  HOTEL: 'Hotel',
  RESTAURANT: 'Restaurant',
  CAFE: 'Café',
  MALL: 'Einkaufszentrum',
  SUPERMARKET: 'Supermarkt',
  SPORT: 'Sportanlage',
  RECREATION_AREA: 'Erholungsgebiet',
  NATURE: 'Naturgebiet',
  MUSEUM: 'Museum',
  BIKE_SHARING: 'Bike-Sharing',
  BUS_STOP: 'Bushaltestelle',
  TAXI_STAND: 'Taxistand',
  TRAM_STOP: 'Tramhaltestelle',
  METRO_STATION: 'Metrostation',
  TRAIN_STATION: 'Bahnhof',
  AIRPORT: 'Flughafen',
  PARKING_LOT: 'Parkplatz',
  CARPOOL_PARKING: 'Fahrgemeinschaftsparkplatz',
  FUEL_STATION: 'Tankstelle',
  WIFI: 'WLAN',
};

export const FACILITIES_FALLBACK_TEXT = 'Keine Angabe';

export const PRICE_COMPONENT_UNITS: Record<string, string> = {
  ENERGY: 'kWh',
  TIME: 'Min',
  PARKING_TIME: 'Min',
  FLAT: 'charge',
};

export const PRICE_FALLBACK_TEXT =
  'Bitte konsultieren Sie für eine Preisauskunft Ihren Anbieter';

export const UNRESOLVED = 'UNCLEARWHATTODOHERE';

/** Maps ISO weekday number (1=Monday … 7=Sunday) to German abbreviation. */
export const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Mo',
  2: 'Di',
  3: 'Mi',
  4: 'Do',
  5: 'Fr',
  6: 'Sa',
  7: 'So',
};

export const RENEWABLE_ENERGY_SOURCE_CATEGORIES = new Set([
  'GENERAL_GREEN',
  'SOLAR',
  'WIND',
  'WATER',
]);

export const OPENING_HOURS_FALLBACK_TEXT = 'Keine Angabe';
export const PAYMENT_FALLBACK_TEXT = 'Keine Angabe';
export const ENERGY_MIX_FALLBACK_TEXT = 'Keine Angabe';
