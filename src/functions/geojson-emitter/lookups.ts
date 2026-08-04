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

export const PRICE_COMPONENT_UNITS: Record<string, string> = {
  ENERGY: 'kWh',
  TIME: 'Min',
  PARKING_TIME: 'Min',
  FLAT: 'charge',
};

export const PRICE_FALLBACK_TEXT =
  'Bitte konsultieren Sie für eine Preisauskunft Ihren Anbieter';

export const UNRESOLVED = 'UNCLEARWHATTODOHERE';
