import {
  buildFeature,
  buildFeatureCollection,
  computeAvailability,
  computeSymbology,
  renderDescription,
} from '../../../../src/functions/geojson-emitter/render';
import type {
  GoldEvse,
  GoldLocation,
} from '../../../../src/functions/geojson-emitter/types';

function makeEvse(overrides: Partial<GoldEvse> = {}): GoldEvse {
  return {
    evse_uid: 'EVSE001',
    status: 'AVAILABLE',
    connectors: [{ standard: 'IEC_62196_T2', max_electric_power: 22000 }],
    ...overrides,
  };
}

function makeLocation(overrides: Partial<GoldLocation> = {}): GoldLocation {
  return {
    country_code: 'CH',
    party_id: 'TIA',
    id: 'LOC002',
    full_location_id: 'CH*TIA*LOC002',
    latitude: 47.123456,
    longitude: 8.234567,
    address_display: 'Teststrasse 1, 8000 Zürich',
    tariffs: [],
    evses: [makeEvse()],
    evse_ids: ['CH*TIA*EVSE001'],
    ...overrides,
  };
}

describe('computeAvailability', () => {
  it('returns Available when any EVSE is available', () => {
    const evses = [
      makeEvse({ status: 'AVAILABLE' }),
      makeEvse({ status: 'CHARGING' }),
    ];
    expect(computeAvailability(evses)).toBe('Available');
  });

  it('prioritises Available over Charging', () => {
    const evses = [
      makeEvse({ status: 'CHARGING' }),
      makeEvse({ status: 'AVAILABLE' }),
    ];
    expect(computeAvailability(evses)).toBe('Available');
  });

  it('returns Charging when charging outranks reserved/outoforder', () => {
    const evses = [
      makeEvse({ status: 'RESERVED' }),
      makeEvse({ status: 'CHARGING' }),
    ];
    expect(computeAvailability(evses)).toBe('Charging');
  });

  it('collapses non-core statuses to Outoforder', () => {
    const evses = [
      makeEvse({ status: 'BLOCKED' }),
      makeEvse({ status: 'INOPERATIVE' }),
    ];
    expect(computeAvailability(evses)).toBe('Outoforder');
  });

  it('treats an unmapped status as Unknown', () => {
    const evses = [makeEvse({ status: 'SOMETHING_NEW' })];
    expect(computeAvailability(evses)).toBe('Unknown');
  });

  it('treats a missing status as Unknown', () => {
    const evses = [makeEvse({ status: undefined })];
    expect(computeAvailability(evses)).toBe('Unknown');
  });

  it('returns Unknown for no EVSEs', () => {
    expect(computeAvailability([])).toBe('Unknown');
  });
});

describe('computeSymbology', () => {
  it('appends _True when any connector meets the fast-charge threshold', () => {
    const evses = [
      makeEvse({
        connectors: [
          { standard: 'IEC_62196_T2_COMBO', max_electric_power: 50000 },
        ],
      }),
    ];
    expect(computeSymbology('Available', evses)).toBe('Available_True');
  });

  it('appends _False when no connector reaches the fast-charge threshold', () => {
    const evses = [
      makeEvse({
        connectors: [{ standard: 'IEC_62196_T2', max_electric_power: 22000 }],
      }),
    ];
    expect(computeSymbology('Available', evses)).toBe('Available_False');
  });

  it('treats exactly the threshold (50000 W) as a fast charger', () => {
    const evses = [
      makeEvse({
        connectors: [{ standard: 'CHADEMO', max_electric_power: 50000 }],
      }),
    ];
    expect(computeSymbology('Charging', evses)).toBe('Charging_True');
  });

  it('appends _False when there are no connectors', () => {
    const evses = [makeEvse({ connectors: [] })];
    expect(computeSymbology('Unknown', evses)).toBe('Unknown_False');
  });
});

describe('renderDescription — pricing', () => {
  it('renders an AD_HOC_PAYMENT tariff price for a connector', () => {
    const location = makeLocation({
      tariffs: [
        {
          id: 'TARIFF1',
          type: 'AD_HOC_PAYMENT',
          currency: 'CHF',
          elements: [{ price_components: [{ type: 'ENERGY', price: 0.45 }] }],
        },
      ],
      evses: [
        makeEvse({
          connectors: [
            {
              standard: 'IEC_62196_T2',
              max_electric_power: 22000,
              tariff_ids: ['TARIFF1'],
            },
          ],
        }),
      ],
    });

    expect(renderDescription(location)).toContain('0.45 CHF/kWh');
  });

  it('sums price components of the same type and orders them by PRICE_COMPONENT_ORDER', () => {
    const location = makeLocation({
      tariffs: [
        {
          id: 'TARIFF1',
          type: 'AD_HOC_PAYMENT',
          currency: 'CHF',
          elements: [
            { price_components: [{ type: 'TIME', price: 0.1 }] },
            { price_components: [{ type: 'ENERGY', price: 0.3 }] },
            { price_components: [{ type: 'ENERGY', price: 0.2 }] },
          ],
        },
      ],
      evses: [
        makeEvse({
          connectors: [
            {
              standard: 'IEC_62196_T2',
              max_electric_power: 22000,
              tariff_ids: ['TARIFF1'],
            },
          ],
        }),
      ],
    });

    // ENERGY (0.3 + 0.2 = 0.5) comes before TIME per PRICE_COMPONENT_ORDER
    expect(renderDescription(location)).toContain('0.5 CHF/kWh + 0.1 CHF/Min');
  });

  it('falls back to the price fallback text when the tariff is not AD_HOC_PAYMENT', () => {
    const location = makeLocation({
      tariffs: [
        {
          id: 'TARIFF1',
          type: 'REGULAR',
          currency: 'CHF',
          elements: [{ price_components: [{ type: 'ENERGY', price: 0.45 }] }],
        },
      ],
      evses: [
        makeEvse({
          connectors: [
            {
              standard: 'IEC_62196_T2',
              max_electric_power: 22000,
              tariff_ids: ['TARIFF1'],
            },
          ],
        }),
      ],
    });

    expect(renderDescription(location)).toContain(
      'Information nicht verfügbar.',
    );
  });

  it('uses the currency fallback when the tariff currency is missing', () => {
    const location = makeLocation({
      tariffs: [
        {
          id: 'TARIFF1',
          type: 'AD_HOC_PAYMENT',
          elements: [{ price_components: [{ type: 'ENERGY', price: 0.45 }] }],
        },
      ],
      evses: [
        makeEvse({
          connectors: [
            {
              standard: 'IEC_62196_T2',
              max_electric_power: 22000,
              tariff_ids: ['TARIFF1'],
            },
          ],
        }),
      ],
    });

    expect(renderDescription(location)).toContain('0.45 CHF/kWh');
  });
});

describe('renderDescription — opening hours', () => {
  it('renders 24/7 as Mo-So, 0:00-24:00 Uhr', () => {
    const location = makeLocation({
      opening_hours_json: JSON.stringify({ twentyfourseven: true }),
    });
    expect(renderDescription(location)).toContain('Mo-So, 0:00-24:00 Uhr');
  });

  it('groups consecutive weekdays with identical hours into a range', () => {
    const location = makeLocation({
      opening_hours_json: JSON.stringify({
        regular_hours: [
          { weekday: 1, period_begin: '08:00', period_end: '18:00' },
          { weekday: 2, period_begin: '08:00', period_end: '18:00' },
          { weekday: 3, period_begin: '08:00', period_end: '18:00' },
        ],
      }),
    });
    expect(renderDescription(location)).toContain('Mo-Mi, 08:00-18:00 Uhr');
  });

  it('renders the opening-hours fallback when the field is absent', () => {
    const location = makeLocation({ opening_hours_json: undefined });
    expect(renderDescription(location)).toContain('Keine Angabe');
  });
});

describe('renderDescription — energy mix, payment & fallbacks', () => {
  it('sums renewable source percentages', () => {
    const location = makeLocation({
      energy_mix_json: JSON.stringify({
        energy_sources: [
          { source: 'SOLAR', percentage: 30 },
          { source: 'WIND', percentage: 20 },
          { source: 'COAL', percentage: 50 },
        ],
      }),
    });
    expect(renderDescription(location)).toContain('50% erneuerbar');
  });

  it('renders Ja when a card payment option is available', () => {
    const location = makeLocation({ credit_card_payable: true });
    expect(renderDescription(location)).toContain(
      'Bezahlmöglichkeit Kredit-/Debitkarte</td><td>Ja',
    );
  });

  it('renders Nein when no card payment option is available', () => {
    const location = makeLocation({
      credit_card_payable: false,
      debit_card_payable: false,
    });
    expect(renderDescription(location)).toContain(
      'Bezahlmöglichkeit Kredit-/Debitkarte</td><td>Nein',
    );
  });

  it('renders the accessible-count fallback when the value ends in /0', () => {
    const location = makeLocation({ accessible_evse_count: '0/0' });
    expect(renderDescription(location)).toContain(
      'Information nicht verfügbar',
    );
  });
});

describe('renderDescription — HTML escaping', () => {
  it('escapes HTML-significant characters in the address', () => {
    const location = makeLocation({ address_display: 'A & B <script>' });
    const html = renderDescription(location);
    expect(html).toContain('A &amp; B &lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
});

describe('buildFeature', () => {
  it('builds a GeoJSON Point feature with [lon, lat] coordinates', () => {
    const feature = buildFeature(makeLocation());
    expect(feature.type).toBe('Feature');
    expect(feature.id).toBe('CH*TIA*LOC002');
    expect(feature.geometry).toEqual({
      type: 'Point',
      coordinates: [8.234567, 47.123456],
    });
  });

  it('exposes location_id, Availability, symbology and description properties', () => {
    const feature = buildFeature(makeLocation());
    expect(feature.properties.location_id).toBe('CH*TIA*LOC002');
    expect(feature.properties.Availability).toBe('Available');
    expect(feature.properties.symbology).toBe('Available_False');
    expect(typeof feature.properties.description).toBe('string');
  });
});

describe('buildFeatureCollection', () => {
  it('wraps features in a FeatureCollection with name, crs and generated_at', () => {
    const collection = buildFeatureCollection(
      [makeLocation()],
      '2026-08-13T00:00:00Z',
    );
    expect(collection.type).toBe('FeatureCollection');
    expect(collection.name).toBe('Charging points for electric cars');
    expect(collection.crs).toEqual({
      type: 'name',
      properties: { name: 'EPSG:4326' },
    });
    expect(collection.generated_at).toBe('2026-08-13T00:00:00Z');
    expect(collection.features).toHaveLength(1);
  });

  it('builds one feature per location', () => {
    const collection = buildFeatureCollection(
      [
        makeLocation({ full_location_id: 'A' }),
        makeLocation({ full_location_id: 'B' }),
      ],
      '2026-08-13T00:00:00Z',
    );
    expect(collection.features.map((f) => f.id)).toEqual(['A', 'B']);
  });

  it('returns an empty feature list for no locations', () => {
    const collection = buildFeatureCollection([], '2026-08-13T00:00:00Z');
    expect(collection.features).toEqual([]);
  });
});
