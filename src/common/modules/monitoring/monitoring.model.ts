/**
 * E-Mobility Monitoring (GET /monitoring/cpos): per-CPO onboarding figures for BFE.
 *
 * The figures come from `ocpi-cpo-monitoring`, which the Glue silver-to-gold job
 * rewrites every run (see emobility-data-pipelines docs/schemas.md), the
 * registered parties from `ocpi-credentials`.
 */

// Item of `ocpi-cpo-monitoring`, pk `CPO#{country_code}*{party_id}`.
export interface CpoMonitoringItem {
  pk: string;
  country_code: string;
  party_id: string;
  locations_total: number;
  locations_published: number;
  evses_total: number;
  tariffs_total: number;
  status_updates_24h: number;
  status_updates_by_day: number[];
  status_updates_days_from: string;
  last_data_at?: string;
  quarantine_pending: number;
  quarantine_by_reason: Record<string, number>;
  updated_at: string;
  job_run_id?: string;
}

export interface MonitoringTotals {
  locations_total: number;
  locations_published: number;
  evses_total: number;
  tariffs_total: number;
  status_updates_24h: number;
  quarantine_pending: number;
  cpos?: number;
  cpos_with_data?: number;
  cpos_in_quarantine?: number;
  built_at?: string;
}

// The `SUMMARY` item: this run's totals plus the previous run's.
export interface CpoMonitoringSummaryItem extends MonitoringTotals {
  pk: 'SUMMARY';
  built_at: string;
  job_run_id?: string;
  previous?: MonitoringTotals;
}

// A CPO role from `ocpi-credentials`, reduced to what may be shown publicly.
export interface RegisteredParty {
  country_code: string;
  party_id: string;
  name: string;
  registered_at: string;
}

export const CPO_STATUSES = [
  'ACTIVE',
  'FIRST_DATA',
  'MASTER_DATA_ONLY',
  'REGISTERED',
  'INACTIVE',
] as const;

export type CpoStatus = (typeof CPO_STATUSES)[number];

export interface StatusThresholds {
  // No data for longer than this → INACTIVE.
  inactiveAfterHours: number;
  // Registered within this many days and delivering → FIRST_DATA.
  firstDataDays: number;
}

export const DEFAULT_STATUS_THRESHOLDS: StatusThresholds = {
  inactiveAfterHours: 48,
  firstDataDays: 14,
};

export interface MonitoringCpo {
  country_code: string;
  party_id: string;
  name: string | null;
  // False for a party that has data but no credentials item (e.g. deleted).
  registered: boolean;
  registered_at: string | null;
  status: CpoStatus;
  locations_total: number;
  locations_published: number;
  evses_total: number;
  tariffs_total: number;
  status_updates_24h: number;
  status_updates_by_day: number[];
  status_updates_days_from: string | null;
  last_data_at: string | null;
  quarantine_pending: number;
  quarantine_by_reason: Record<string, number>;
}

export interface MonitoringSummary {
  cpos_registered: number;
  cpos_with_data: number;
  cpos_in_quarantine: number;
  locations_total: number;
  locations_published: number;
  evses_total: number;
  tariffs_total: number;
  status_updates_24h: number;
  quarantine_pending: number;
}

export interface MonitoringResponse {
  // When the Glue run that wrote the figures finished building them (null before the first run).
  built_at: string | null;
  generated_at: string;
  summary: MonitoringSummary;
  // Totals of the run before, for the deltas on the page (null if unknown).
  previous: MonitoringTotals | null;
  status_counts: Record<CpoStatus, number>;
  cpos: MonitoringCpo[];
}
