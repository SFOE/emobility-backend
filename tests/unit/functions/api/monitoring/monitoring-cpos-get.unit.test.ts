jest.mock('/opt/nodejs/modules/monitoring/monitoring.db');
jest.mock('/opt/nodejs/modules/monitoring/monitoring.service');

import { handler } from '../../../../../src/functions/api/monitoring/monitoring-cpos-get';
import {
  fetchMonitoringItems,
  fetchRegisteredParties,
} from '/opt/nodejs/modules/monitoring/monitoring.db';
import { DEFAULT_STATUS_THRESHOLDS } from '/opt/nodejs/modules/monitoring/monitoring.model';
import { buildMonitoringResponse } from '/opt/nodejs/modules/monitoring/monitoring.service';

const mockFetchMonitoringItems = fetchMonitoringItems as jest.MockedFunction<
  typeof fetchMonitoringItems
>;
const mockFetchRegisteredParties =
  fetchRegisteredParties as jest.MockedFunction<typeof fetchRegisteredParties>;
const mockBuildMonitoringResponse =
  buildMonitoringResponse as jest.MockedFunction<
    typeof buildMonitoringResponse
  >;

describe('GET /monitoring/cpos', () => {
  beforeEach(() => jest.resetAllMocks());

  it('merges parties and figures and returns them as OCPI data', async () => {
    const parties = [
      {
        country_code: 'CH',
        party_id: 'AAA',
        name: 'Ladenetz AG',
        registered_at: '2026-09-01T08:00:00Z',
      },
    ];
    mockFetchRegisteredParties.mockResolvedValue(parties);
    mockFetchMonitoringItems.mockResolvedValue({ cpos: [], summary: null });
    mockBuildMonitoringResponse.mockReturnValue({ cpos: [] } as never);

    const result = await handler();

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toMatchObject({
      status_code: 1000,
      data: { cpos: [] },
    });
    expect(mockBuildMonitoringResponse).toHaveBeenCalledWith(
      parties,
      [],
      null,
      expect.any(Date),
      DEFAULT_STATUS_THRESHOLDS,
    );
  });

  it('returns 500 when a table cannot be read', async () => {
    mockFetchRegisteredParties.mockRejectedValue(new Error('boom'));
    mockFetchMonitoringItems.mockResolvedValue({ cpos: [], summary: null });
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await handler();

    expect(result.statusCode).toBe(500);
  });
});
