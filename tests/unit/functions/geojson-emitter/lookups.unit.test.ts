import {
  AD_HOC_PAYMENT_TARIFF_TYPE,
  CONNECTOR_STANDARD_LABELS,
  ENERGY_UNIT,
  PRICE_COMPONENT_ORDER,
  RENEWABLE_ENERGY_SOURCE_CATEGORIES,
  STATUS_CATEGORY_MAP,
  STATUS_CSS_CLASS,
} from '../../../../src/functions/geojson-emitter/lookups';

describe('STATUS_CATEGORY_MAP / STATUS_CSS_CLASS consistency', () => {
  it('maps every category to one of the five display classes', () => {
    const displayClasses = new Set(Object.keys(STATUS_CSS_CLASS));
    for (const category of Object.values(STATUS_CATEGORY_MAP)) {
      expect(displayClasses.has(category)).toBe(true);
    }
  });

  it('collapses non-core statuses into OUTOFORDER', () => {
    expect(STATUS_CATEGORY_MAP['PLANNED']).toBe('OUTOFORDER');
    expect(STATUS_CATEGORY_MAP['BLOCKED']).toBe('OUTOFORDER');
    expect(STATUS_CATEGORY_MAP['INOPERATIVE']).toBe('OUTOFORDER');
    expect(STATUS_CATEGORY_MAP['REMOVED']).toBe('OUTOFORDER');
  });

  it('keeps the four core statuses as their own category', () => {
    expect(STATUS_CATEGORY_MAP['AVAILABLE']).toBe('AVAILABLE');
    expect(STATUS_CATEGORY_MAP['CHARGING']).toBe('CHARGING');
    expect(STATUS_CATEGORY_MAP['RESERVED']).toBe('RESERVED');
    expect(STATUS_CATEGORY_MAP['UNKNOWN']).toBe('UNKNOWN');
  });

  it('provides a non-empty CSS class for each display class', () => {
    for (const cssClass of Object.values(STATUS_CSS_CLASS)) {
      expect(typeof cssClass).toBe('string');
      expect(cssClass.length).toBeGreaterThan(0);
    }
  });
});

describe('price component tables', () => {
  it('orders the expected price component types', () => {
    expect(PRICE_COMPONENT_ORDER).toEqual([
      'ENERGY',
      'FLAT',
      'PARKING_TIME',
      'TIME',
    ]);
  });

  it('uses kWh as the (universal) energy unit', () => {
    expect(ENERGY_UNIT).toBe('kWh');
  });

  it('exposes AD_HOC_PAYMENT as the ad-hoc tariff type', () => {
    expect(AD_HOC_PAYMENT_TARIFF_TYPE).toBe('AD_HOC_PAYMENT');
  });
});

describe('CONNECTOR_STANDARD_LABELS', () => {
  it('maps common OCPI standards to friendly names', () => {
    expect(CONNECTOR_STANDARD_LABELS['IEC_62196_T2']).toBe('Type 2');
    expect(CONNECTOR_STANDARD_LABELS['IEC_62196_T2_COMBO']).toBe('CCS');
    expect(CONNECTOR_STANDARD_LABELS['CHADEMO']).toBe('CHAdeMO');
  });
});

describe('RENEWABLE_ENERGY_SOURCE_CATEGORIES', () => {
  it('contains the renewable source categories', () => {
    expect(RENEWABLE_ENERGY_SOURCE_CATEGORIES.has('SOLAR')).toBe(true);
    expect(RENEWABLE_ENERGY_SOURCE_CATEGORIES.has('WIND')).toBe(true);
    expect(RENEWABLE_ENERGY_SOURCE_CATEGORIES.has('WATER')).toBe(true);
    expect(RENEWABLE_ENERGY_SOURCE_CATEGORIES.has('GENERAL_GREEN')).toBe(true);
  });

  it('does not treat non-renewable sources as renewable', () => {
    expect(RENEWABLE_ENERGY_SOURCE_CATEGORIES.has('COAL')).toBe(false);
    expect(RENEWABLE_ENERGY_SOURCE_CATEGORIES.has('NUCLEAR')).toBe(false);
  });
});
