import {
  CpoMonitoringItem,
  DEFAULT_STATUS_THRESHOLDS,
  RegisteredParty,
} from '/opt/nodejs/modules/monitoring/monitoring.model';
import {
  buildMonitoringResponse,
  deriveStatus,
} from '/opt/nodejs/modules/monitoring/monitoring.service';

const NOW = new Date('2026-11-12T10:30:00Z');

const item = (
  overrides: Partial<CpoMonitoringItem> = {},
): CpoMonitoringItem => ({
  pk: 'CPO#CH*AAA',
  country_code: 'CH',
  party_id: 'AAA',
  locations_total: 10,
  locations_published: 8,
  evses_total: 30,
  tariffs_total: 2,
  status_updates_24h: 500,
  status_updates_by_day: [1, 2, 3, 4, 5, 6, 7],
  status_updates_days_from: '2026-11-06',
  last_data_at: '2026-11-12T09:00:00Z',
  quarantine_pending: 0,
  quarantine_by_reason: {},
  updated_at: '2026-11-12T10:00:00Z',
  ...overrides,
});

const party = (overrides: Partial<RegisteredParty> = {}): RegisteredParty => ({
  country_code: 'CH',
  party_id: 'AAA',
  name: 'Ladenetz AG',
  registered_at: '2026-09-01T08:00:00Z',
  ...overrides,
});

const status = (
  monitoringItem: CpoMonitoringItem | undefined,
  registeredAt: string | null = '2026-09-01T08:00:00Z',
) => deriveStatus(monitoringItem, registeredAt, NOW, DEFAULT_STATUS_THRESHOLDS);

describe('deriveStatus', () => {
  it('is REGISTERED without any figures', () => {
    expect(status(undefined)).toBe('REGISTERED');
  });

  it('is REGISTERED with only quarantined events', () => {
    expect(
      status(
        item({
          locations_total: 0,
          evses_total: 0,
          tariffs_total: 0,
          last_data_at: undefined,
          quarantine_pending: 4,
        }),
      ),
    ).toBe('REGISTERED');
  });

  it('is INACTIVE when the latest data is older than 48 h', () => {
    expect(status(item({ last_data_at: '2026-11-10T10:29:00Z' }))).toBe(
      'INACTIVE',
    );
  });

  it('is INACTIVE for data without a known last date', () => {
    expect(status(item({ last_data_at: undefined }))).toBe('INACTIVE');
  });

  it('is FIRST_DATA when registered less than 14 days ago', () => {
    expect(status(item(), '2026-11-01T00:00:00Z')).toBe('FIRST_DATA');
  });

  it('is MASTER_DATA_ONLY without status updates in 24 h', () => {
    expect(status(item({ status_updates_24h: 0 }))).toBe('MASTER_DATA_ONLY');
  });

  it('is ACTIVE otherwise', () => {
    expect(status(item())).toBe('ACTIVE');
  });

  it('uses the given thresholds', () => {
    expect(
      deriveStatus(
        item({ last_data_at: '2026-11-12T08:00:00Z' }),
        '2026-09-01T08:00:00Z',
        NOW,
        { inactiveAfterHours: 1, firstDataDays: 14 },
      ),
    ).toBe('INACTIVE');
  });
});

describe('buildMonitoringResponse', () => {
  it('lists registered CPOs without figures and parties with figures but no credentials', () => {
    const response = buildMonitoringResponse(
      [party(), party({ party_id: 'NEW', name: 'Neu AG' })],
      [
        item(),
        item({ pk: 'CPO#CH*OLD', party_id: 'OLD', last_data_at: undefined }),
      ],
      null,
      NOW,
      DEFAULT_STATUS_THRESHOLDS,
    );

    expect(
      response.cpos.map((cpo) => [cpo.party_id, cpo.status, cpo.registered]),
    ).toEqual([
      ['AAA', 'ACTIVE', true],
      ['NEW', 'REGISTERED', true],
      ['OLD', 'INACTIVE', false],
    ]);
    const unregistered = response.cpos.find((cpo) => cpo.party_id === 'OLD');
    expect(unregistered?.name).toBeNull();
    expect(response.built_at).toBeNull();
    expect(response.previous).toBeNull();
  });

  it('keeps the first registration of a party registered twice', () => {
    const response = buildMonitoringResponse(
      [
        party({ registered_at: '2026-10-05T00:00:00Z', name: 'Neuer Name' }),
        party({ registered_at: '2026-09-01T00:00:00Z' }),
      ],
      [],
      null,
      NOW,
      DEFAULT_STATUS_THRESHOLDS,
    );

    expect(response.cpos).toHaveLength(1);
    expect(response.cpos[0].registered_at).toBe('2026-09-01T00:00:00Z');
  });

  it('sums the figures, counts statuses and passes the previous totals', () => {
    const previous = {
      locations_total: 5,
      locations_published: 4,
      evses_total: 20,
      tariffs_total: 1,
      status_updates_24h: 100,
      quarantine_pending: 0,
      built_at: '2026-11-11T22:00:00Z',
    };
    const response = buildMonitoringResponse(
      [party(), party({ party_id: 'BBB', name: 'B AG' })],
      [
        item(),
        item({
          pk: 'CPO#CH*BBB',
          party_id: 'BBB',
          status_updates_24h: 0,
          quarantine_pending: 3,
        }),
      ],
      {
        ...previous,
        pk: 'SUMMARY',
        built_at: '2026-11-12T10:00:00Z',
        previous,
      },
      NOW,
      DEFAULT_STATUS_THRESHOLDS,
    );

    expect(response.summary).toEqual({
      cpos_registered: 2,
      cpos_with_data: 2,
      cpos_in_quarantine: 1,
      locations_total: 20,
      locations_published: 16,
      evses_total: 60,
      tariffs_total: 4,
      status_updates_24h: 500,
      quarantine_pending: 3,
    });
    expect(response.status_counts).toEqual({
      ACTIVE: 1,
      FIRST_DATA: 0,
      MASTER_DATA_ONLY: 1,
      REGISTERED: 0,
      INACTIVE: 0,
    });
    expect(response.built_at).toBe('2026-11-12T10:00:00Z');
    expect(response.previous).toEqual(previous);
  });
});
