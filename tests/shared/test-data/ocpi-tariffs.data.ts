import { Tariff } from '/opt/nodejs/modules/ocpi-tariffs/ocpi-tariffs.model';

// A minimal but realistic tariff: 0.35 CHF/kWh, 7.7% VAT, taxes included.
export const VALID_TARIFF: Tariff = {
  country_code: 'DE',
  party_id: 'EMS',
  id: 'KKK',
  currency: 'CHF',
  elements: [
    {
      price_components: [
        {
          type: 'ENERGY',
          price: 0.35,
          vat: 7.7,
          step_size: 1,
        },
      ],
    },
  ],
  tax_included: 'YES',
  last_updated: '2025-01-01T00:00:00Z',
};

export const TARIFF_ID = VALID_TARIFF.id;
