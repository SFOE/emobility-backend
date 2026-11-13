jest.mock('/opt/nodejs/aws/dynamodb');

import { fetchAll } from '/opt/nodejs/aws/dynamodb';
import {
  fetchMonitoringItems,
  fetchRegisteredParties,
} from '/opt/nodejs/modules/monitoring/monitoring.db';

const mockFetchAll = fetchAll as jest.MockedFunction<typeof fetchAll>;

describe('fetchMonitoringItems', () => {
  beforeEach(() => jest.resetAllMocks());

  it('splits CPO items from the SUMMARY item', async () => {
    mockFetchAll.mockResolvedValue([
      { pk: 'CPO#CH*AAA' },
      { pk: 'SUMMARY', built_at: '2026-11-12T10:00:00Z' },
      { pk: 'CPO#CH*BBB' },
    ]);

    const result = await fetchMonitoringItems();

    expect(mockFetchAll).toHaveBeenCalledWith('ocpi-cpo-monitoring');
    expect(result.cpos.map((item) => item.pk)).toEqual([
      'CPO#CH*AAA',
      'CPO#CH*BBB',
    ]);
    expect(result.summary?.built_at).toBe('2026-11-12T10:00:00Z');
  });

  it('returns no summary before the first Glue run', async () => {
    mockFetchAll.mockResolvedValue([]);

    expect(await fetchMonitoringItems()).toEqual({ cpos: [], summary: null });
  });
});

describe('fetchRegisteredParties', () => {
  beforeEach(() => jest.resetAllMocks());

  it('returns only name, party and date of CPO roles, skipping bootstrap items', async () => {
    mockFetchAll.mockResolvedValue([
      {
        pk: 'TOKEN#abc',
        sk: 'CREDENTIALS',
        secretRef: 'secret',
        url: 'https://cpo.example/ocpi/versions',
        createdAt: '2026-10-01T08:00:00Z',
        roles: [
          {
            role: 'CPO',
            country_code: 'CH',
            party_id: 'AAA',
            business_details: { name: 'Ladenetz AG' },
          },
          {
            role: 'EMSP',
            country_code: 'CH',
            party_id: 'EEE',
            business_details: { name: 'Roaming AG' },
          },
        ],
      },
      {
        pk: 'TOKEN#boot',
        sk: 'CREDENTIALS',
        bootstrapToken: true,
        createdAt: '2026-01-01T00:00:00Z',
        roles: [
          {
            role: 'CPO',
            country_code: 'CH',
            party_id: 'BFE',
            business_details: { name: 'Bootstrap' },
          },
        ],
      },
    ]);

    const parties = await fetchRegisteredParties();

    expect(mockFetchAll).toHaveBeenCalledWith('ocpi-credentials');
    expect(parties).toEqual([
      {
        country_code: 'CH',
        party_id: 'AAA',
        name: 'Ladenetz AG',
        registered_at: '2026-10-01T08:00:00Z',
      },
    ]);
  });
});
