export type TariffDimensionType = 'ENERGY' | 'FLAT' | 'PARKING_TIME' | 'TIME';
export type TariffType = 'AD_HOC_PAYMENT' | 'PROFILE_CHEAP' | 'PROFILE_FAST' | 'PROFILE_GREEN' | 'REGULAR';
export type TaxIncluded = 'YES' | 'NO' | 'N/A';
export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export interface PriceComponent {
  type: TariffDimensionType;
  price: number;
  vat?: number;
  step_size: number;
}

export interface TariffRestrictions {
  start_time?: string;
  end_time?: string;
  day_of_week?: DayOfWeek[];
  min_kwh?: number;
  max_kwh?: number;
  min_duration?: number;
  max_duration?: number;
}

export interface TariffElement {
  price_components: PriceComponent[];
  restrictions?: TariffRestrictions;
}

export interface Tariff {
  country_code: string;
  party_id: string;
  id: string;
  currency: string;
  type?: TariffType;
  elements: TariffElement[];
  tax_included: TaxIncluded;
  last_updated: string;
}
