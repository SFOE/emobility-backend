import { Connector, EVSE, Location } from '/opt/nodejs/modules/ocpi-locations/ocpi-locations.model';

export const LOCATION_ID = 'LOC001';
export const EVSE_UID = 'EVSE001';
export const CONNECTOR_ID = '1';

// A minimal but realistic charging location in Berlin.
export const VALID_LOCATION: Location = {
  country_code: 'DE',
  party_id: 'EMS',
  id: LOCATION_ID,
  publish: true,
  address: 'Teststrasse 1',
  city: 'Berlin',
  country: 'DEU',
  coordinates: { latitude: '52.520008', longitude: '13.404954' },
  time_zone: 'Europe/Berlin',
  last_updated: '2025-01-01T00:00:00Z',
};

// A minimal EVSE at the above location.
export const VALID_EVSE: EVSE = {
  uid: EVSE_UID,
  status: 'AVAILABLE',
  connectors: [],
  last_updated: '2025-01-01T00:00:00Z',
};

// A minimal AC Type 2 connector on the above EVSE.
export const VALID_CONNECTOR: Connector = {
  id: CONNECTOR_ID,
  standard: 'IEC_62196_T2',
  format: 'SOCKET',
  power_type: 'AC_3_PHASE',
  max_voltage: 400,
  max_amperage: 32,
  last_updated: '2025-01-01T00:00:00Z',
};

// A minimal valid PATCH body — only last_updated is mandatory per OCPI spec.
export const VALID_PATCH = { last_updated: '2025-06-01T00:00:00Z', status: 'CHARGING' };
