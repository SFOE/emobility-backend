/**
 * Static OCPI-to-legacy-label translation tables and shared placeholder constants.
 *
 * Kept in one place, separate from render.ts's logic, so a translation can be
 * corrected without touching rendering code once compared against real
 * production samples.
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

export const STATUS_CLASS_LABELS: Record<string, [string, string]> = {
  AVAILABLE: ['available', 'Verfügbar'],
  CHARGING: ['charging', 'Besetzt'],
  RESERVED: ['reserved', 'Reserviert'],
  UNKNOWN: ['unknown', 'Verfügbarkeit unbekannt'],
  OUTOFORDER: ['outoforder', 'Ausser Betrieb'],
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
  FLAT: 'Ladung',
};

export const PRICE_COMPONENT_ORDER = ['ENERGY', 'FLAT', 'PARKING_TIME', 'TIME'];

export const AD_HOC_PAYMENT_TARIFF_TYPE = 'AD_HOC_PAYMENT';

export const PRICE_CURRENCY_FALLBACK = 'CHF';

export const PRICE_FALLBACK_TEXT = 'Information nicht verfügbar.';

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
export const ENERGY_MIX_FALLBACK_TEXT = 'Keine Angabe';

export const VEHICLE_TYPE_LABELS: Record<string, string> = {
  MOTORCYCLE: 'Motorrad',
  PERSONAL_VEHICLE: 'Personenwagen',
  PERSONAL_VEHICLE_WITH_TRAILER: 'Personenwagen mit Anhänger',
  VAN: 'Lieferwagen',
  SEMI_TRACTOR: 'Sattelschlepper',
  RIGID: 'Lastwagen (Solo)',
  TRUCK_WITH_TRAILER: 'Lastwagen mit Anhänger',
  BUS: 'Bus',
  DISABLED: 'Behindertenparkplatz',
};

export const VEHICLE_TYPES_FALLBACK_TEXT = 'Information nicht verfügbar';
export const ACCESSIBLE_EVSE_COUNT_FALLBACK_TEXT = 'Information nicht verfügbar';