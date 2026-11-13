import {
  CPO_STATUSES,
  CpoMonitoringItem,
  CpoMonitoringSummaryItem,
  CpoStatus,
  MonitoringCpo,
  MonitoringResponse,
  MonitoringSummary,
  RegisteredParty,
  StatusThresholds,
} from './monitoring.model';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const partyKey = (countryCode: string, partyId: string): string =>
  `${countryCode}*${partyId}`;

const hasData = (item: CpoMonitoringItem | undefined): boolean =>
  !!item &&
  (item.locations_total > 0 ||
    item.evses_total > 0 ||
    item.tariffs_total > 0 ||
    !!item.last_data_at);

/**
 * Onboarding status of one CPO at `now`, checked in this order:
 * - REGISTERED: no data at all yet (only a credentials handshake, maybe quarantine)
 * - INACTIVE: the latest data is older than `inactiveAfterHours`
 * - FIRST_DATA: registered less than `firstDataDays` ago
 * - MASTER_DATA_ONLY: no EVSE status update in the last 24 h
 * - ACTIVE: otherwise
 */
export const deriveStatus = (
  item: CpoMonitoringItem | undefined,
  registeredAt: string | null,
  now: Date,
  thresholds: StatusThresholds,
): CpoStatus => {
  if (!item || !hasData(item)) {
    return 'REGISTERED';
  }
  const lastDataAt = item.last_data_at ? Date.parse(item.last_data_at) : NaN;
  if (
    Number.isNaN(lastDataAt) ||
    now.getTime() - lastDataAt > thresholds.inactiveAfterHours * HOUR_MS
  ) {
    return 'INACTIVE';
  }
  const registered = registeredAt ? Date.parse(registeredAt) : NaN;
  if (
    !Number.isNaN(registered) &&
    now.getTime() - registered < thresholds.firstDataDays * DAY_MS
  ) {
    return 'FIRST_DATA';
  }
  if (item.status_updates_24h === 0) {
    return 'MASTER_DATA_ONLY';
  }
  return 'ACTIVE';
};

// One entry per party; a party registered several times keeps its first registration.
const indexParties = (
  parties: RegisteredParty[],
): Map<string, RegisteredParty> => {
  const byKey = new Map<string, RegisteredParty>();
  for (const party of parties) {
    const key = partyKey(party.country_code, party.party_id);
    const known = byKey.get(key);
    if (!known || party.registered_at < known.registered_at) {
      byKey.set(key, { ...party, name: party.name || known?.name || '' });
    }
  }
  return byKey;
};

const toCpo = (
  countryCode: string,
  partyId: string,
  party: RegisteredParty | undefined,
  item: CpoMonitoringItem | undefined,
  now: Date,
  thresholds: StatusThresholds,
): MonitoringCpo => {
  const registeredAt = party?.registered_at ?? null;
  return {
    country_code: countryCode,
    party_id: partyId,
    name: party?.name || null,
    registered: !!party,
    registered_at: registeredAt,
    status: deriveStatus(item, registeredAt, now, thresholds),
    locations_total: item?.locations_total ?? 0,
    locations_published: item?.locations_published ?? 0,
    evses_total: item?.evses_total ?? 0,
    tariffs_total: item?.tariffs_total ?? 0,
    status_updates_24h: item?.status_updates_24h ?? 0,
    status_updates_by_day: item?.status_updates_by_day ?? [],
    status_updates_days_from: item?.status_updates_days_from ?? null,
    last_data_at: item?.last_data_at ?? null,
    quarantine_pending: item?.quarantine_pending ?? 0,
    quarantine_by_reason: item?.quarantine_by_reason ?? {},
  };
};

const summarize = (cpos: MonitoringCpo[]): MonitoringSummary => {
  const sum = (field: keyof MonitoringCpo) =>
    cpos.reduce((total, cpo) => total + (cpo[field] as number), 0);
  return {
    cpos_registered: cpos.filter((cpo) => cpo.registered).length,
    cpos_with_data: cpos.filter(
      (cpo) => cpo.locations_total || cpo.evses_total || cpo.tariffs_total,
    ).length,
    cpos_in_quarantine: cpos.filter((cpo) => cpo.quarantine_pending > 0).length,
    locations_total: sum('locations_total'),
    locations_published: sum('locations_published'),
    evses_total: sum('evses_total'),
    tariffs_total: sum('tariffs_total'),
    status_updates_24h: sum('status_updates_24h'),
    quarantine_pending: sum('quarantine_pending'),
  };
};

/**
 * Merges the registered parties with the Glue-written figures: every registered
 * CPO appears (also before the next Glue run), and so does every party with
 * figures but no credentials item. Sorted by status (in CPO_STATUSES order),
 * then by name or party.
 */
export const buildMonitoringResponse = (
  parties: RegisteredParty[],
  items: CpoMonitoringItem[],
  summary: CpoMonitoringSummaryItem | null,
  now: Date,
  thresholds: StatusThresholds,
): MonitoringResponse => {
  const partiesByKey = indexParties(parties);
  const itemsByKey = new Map(
    items.map((item) => [partyKey(item.country_code, item.party_id), item]),
  );
  const keys = new Set([...partiesByKey.keys(), ...itemsByKey.keys()]);

  const cpos = [...keys].map((key) => {
    const party = partiesByKey.get(key);
    const item = itemsByKey.get(key);
    const [countryCode, partyId] = key.split('*');
    return toCpo(countryCode, partyId, party, item, now, thresholds);
  });

  const statusRank = (status: CpoStatus) => CPO_STATUSES.indexOf(status);
  const label = (cpo: MonitoringCpo) =>
    (cpo.name ?? `${cpo.country_code}*${cpo.party_id}`).toLowerCase();
  cpos.sort(
    (a, b) =>
      statusRank(a.status) - statusRank(b.status) ||
      label(a).localeCompare(label(b)),
  );

  const statusCounts = Object.fromEntries(
    CPO_STATUSES.map((status) => [
      status,
      cpos.filter((cpo) => cpo.status === status).length,
    ]),
  ) as Record<CpoStatus, number>;

  return {
    built_at: summary?.built_at ?? null,
    generated_at: now.toISOString(),
    summary: summarize(cpos),
    previous: summary?.previous ?? null,
    status_counts: statusCounts,
    cpos,
  };
};
