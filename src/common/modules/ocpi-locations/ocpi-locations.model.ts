// ─── Enums ────────────────────────────────────────────────────────────────────

export type EVSEStatus =
  | 'AVAILABLE'
  | 'BLOCKED'
  | 'CHARGING'
  | 'INOPERATIVE'
  | 'OUTOFORDER'
  | 'PLANNED'
  | 'REMOVED'
  | 'RESERVED'
  | 'UNKNOWN';

export type ConnectorType =
  | 'CHADEMO'
  | 'CHAOJI'
  | 'DOMESTIC_A'
  | 'DOMESTIC_B'
  | 'DOMESTIC_C'
  | 'DOMESTIC_D'
  | 'DOMESTIC_E'
  | 'DOMESTIC_F'
  | 'DOMESTIC_G'
  | 'DOMESTIC_H'
  | 'DOMESTIC_I'
  | 'DOMESTIC_J'
  | 'DOMESTIC_K'
  | 'DOMESTIC_L'
  | 'DOMESTIC_M'
  | 'DOMESTIC_N'
  | 'DOMESTIC_O'
  | 'GBT_AC'
  | 'GBT_DC'
  | 'IEC_60309_2_single_16'
  | 'IEC_60309_2_three_16'
  | 'IEC_60309_2_three_32'
  | 'IEC_60309_2_three_64'
  | 'IEC_62196_T1'
  | 'IEC_62196_T1_COMBO'
  | 'IEC_62196_T2'
  | 'IEC_62196_T2_COMBO'
  | 'IEC_62196_T3A'
  | 'IEC_62196_T3C'
  | 'MCS'
  | 'NEMA_5_20'
  | 'NEMA_6_30'
  | 'NEMA_6_50'
  | 'NEMA_10_30'
  | 'NEMA_10_50'
  | 'NEMA_14_30'
  | 'NEMA_14_50'
  | 'PANTOGRAPH_BOTTOM_UP'
  | 'PANTOGRAPH_TOP_DOWN'
  | 'SAE_J3400'
  | 'TESLA_R'
  | 'TESLA_S';

export type ConnectorFormat = 'SOCKET' | 'CABLE';

export type PowerType = 'AC_1_PHASE' | 'AC_2_PHASE' | 'AC_2_PHASE_SPLIT' | 'AC_3_PHASE' | 'DC';

export type ParkingType =
  | 'ALONG_MOTORWAY'
  | 'PARKING_GARAGE'
  | 'PARKING_LOT'
  | 'ON_DRIVEWAY'
  | 'ON_STREET'
  | 'UNDERGROUND_GARAGE';

export type Capability =
  | 'CHARGING_PROFILE_CAPABLE'
  | 'CHARGING_PREFERENCES_CAPABLE'
  | 'CHIP_CARD_SUPPORT'
  | 'CONTACTLESS_CARD_SUPPORT'
  | 'CREDIT_CARD_PAYABLE'
  | 'DEBIT_CARD_PAYABLE'
  | 'PED_TERMINAL'
  | 'REMOTE_START_STOP_CAPABLE'
  | 'RESERVABLE'
  | 'RFID_READER'
  | 'START_SESSION_CONNECTOR_REQUIRED'
  | 'TOKEN_GROUP_CAPABLE'
  | 'UNLOCK_CAPABLE';

export type ConnectorCapability =
  | 'ISO_15118_2_PLUG_AND_CHARGE'
  | 'ISO_15118_20_PLUG_AND_CHARGE';

export type ParkingRestriction = 'EV_ONLY' | 'PLUGGED' | 'DISABLED' | 'CUSTOMERS' | 'MOTORCYCLES';

export type Facility =
  | 'HOTEL'
  | 'RESTAURANT'
  | 'CAFE'
  | 'MALL'
  | 'SUPERMARKET'
  | 'SPORT'
  | 'RECREATION_AREA'
  | 'NATURE'
  | 'MUSEUM'
  | 'BIKE_SHARING'
  | 'BUS_STOP'
  | 'TAXI_STAND'
  | 'TRAM_STOP'
  | 'METRO_STATION'
  | 'TRAIN_STATION'
  | 'AIRPORT'
  | 'PARKING_LOT'
  | 'CARPOOL_PARKING'
  | 'FUEL_STATION'
  | 'WIFI';

export type VehicleType =
  | 'MOTORCYCLE'
  | 'PERSONAL_VEHICLE'
  | 'VAN'
  | 'SEMI_TRACTOR'
  | 'RIGID'
  | 'TRUCK_WITH_TRAILER'
  | 'BUS'
  | 'DISABLED';

export type ParkingDirection = 'LEFT' | 'RIGHT' | 'STRAIGHT' | 'NO_DIRECTION';

export type EnergySourceCategory =
  | 'NUCLEAR'
  | 'GENERAL_FOSSIL'
  | 'COAL'
  | 'GAS'
  | 'GENERAL_GREEN'
  | 'SOLAR'
  | 'WIND'
  | 'WATER';

export type EnvironmentalImpactCategory = 'NUCLEAR_WASTE' | 'CARBON_DIOXIDE';

export type ImageCategory =
  | 'CHARGER'
  | 'ENTRANCE'
  | 'LOCATION'
  | 'NETWORK'
  | 'OPERATOR'
  | 'OTHER'
  | 'OWNER';

export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export type TokenType = 'AD_HOC_USER' | 'APP_USER' | 'OTHER' | 'RFID';

// ─── Supporting Types ─────────────────────────────────────────────────────────

export interface GeoLocation {
  latitude: string;
  longitude: string;
}

export interface AdditionalGeoLocation {
  latitude: string;
  longitude: string;
  name?: DisplayText;
}

export interface DisplayText {
  language: string;
  text: string;
}

export interface BusinessDetails {
  name: string;
  website?: string;
  logo?: Image;
}

export interface Image {
  url: string;
  thumbnail?: string;
  category: ImageCategory;
  type: string;
  width?: number;
  height?: number;
}

export interface EnergySource {
  source: EnergySourceCategory;
  percentage: number;
}

export interface EnvironmentalImpact {
  category: EnvironmentalImpactCategory;
  amount: number;
}

export interface EnergyMix {
  is_green_energy: boolean;
  energy_sources?: EnergySource[];
  environ_impact?: EnvironmentalImpact[];
  supplier_name?: string;
  energy_product_name?: string;
}

export interface RegularHours {
  weekday: number;
  period_begin: string;
  period_end: string;
}

export interface ExceptionalPeriod {
  period_begin: string;
  period_end: string;
}

export interface Hours {
  twentyfourseven: boolean;
  regular_hours?: RegularHours[];
  exceptional_openings?: ExceptionalPeriod[];
  exceptional_closings?: ExceptionalPeriod[];
}

export interface PublishTokenType {
  uid?: string;
  type?: TokenType;
  visual_number?: string;
  issuer?: string;
  group_id?: string;
}

export interface StatusSchedule {
  period_begin: string;
  period_end?: string;
  status: EVSEStatus;
}

export interface EVSEParking {
  id: string;
}

// ─── Core Objects ─────────────────────────────────────────────────────────────

export interface Connector {
  id: string;
  standard: ConnectorType;
  format: ConnectorFormat;
  power_type: PowerType;
  max_voltage: number;
  max_amperage: number;
  max_electric_power?: number;
  tariff_ids?: string[];
  terms_and_conditions?: string;
  capabilities?: ConnectorCapability[];
  last_updated: string;
}

export interface Parking {
  id: string;
  physical_reference?: string;
  vehicle_types: VehicleType[];
  max_vehicle_weight?: number;
  max_vehicle_height?: number;
  max_vehicle_length?: number;
  max_vehicle_width?: number;
  parking_space_length?: number;
  parking_space_width?: number;
  dangerous_goods_allowed?: boolean;
  direction?: ParkingDirection;
  drive_through?: boolean;
  restricted_to_type: boolean;
  reservation_required: boolean;
  time_limit?: number;
  roofed?: boolean;
  images?: Image[];
  lighting?: boolean;
  refrigeration_outlet?: boolean;
  standards?: string[];
  apds_reference?: string;
}

export interface EVSE {
  uid: string;
  evse_id?: string;
  status: EVSEStatus;
  status_schedule?: StatusSchedule[];
  capabilities?: Capability[];
  connectors: Connector[];
  floor_level?: string;
  coordinates?: GeoLocation;
  physical_reference?: string;
  directions?: DisplayText[];
  parking_restrictions?: ParkingRestriction[];
  parking?: EVSEParking[];
  images?: Image[];
  accepted_service_providers?: string[];
  last_updated: string;
}

export interface Location {
  country_code: string;
  party_id: string;
  id: string;
  publish: boolean;
  publish_allowed_to?: PublishTokenType[];
  name?: string;
  address: string;
  city: string;
  postal_code?: string;
  state?: string;
  country: string;
  coordinates: GeoLocation;
  related_locations?: AdditionalGeoLocation[];
  parking_type?: ParkingType;
  evses?: EVSE[];
  parking_places?: Parking[];
  directions?: DisplayText[];
  operator?: BusinessDetails;
  suboperator?: BusinessDetails;
  owner?: BusinessDetails;
  facilities?: Facility[];
  time_zone: string;
  opening_times?: Hours;
  charging_when_closed?: boolean;
  images?: Image[];
  energy_mix?: EnergyMix;
  help_phone?: string;
  last_updated: string;
}
