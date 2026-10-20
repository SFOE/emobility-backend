jest.mock('/opt/nodejs/modules/ocpi-public/ocpi-public.db');

import { APIGatewayProxyResult } from 'aws-lambda';
import { handler as getStatus } from '../../../../../src/functions/api/public/status/status-get';
import { handler as listStatuses } from '../../../../../src/functions/api/public/status/status-list';
import {
  getEvseStatus,
  listEvseStatusesSince,
} from '/opt/nodejs/modules/ocpi-public/ocpi-public.db';
import {
  buildStatusGetEvent,
  buildStatusListEvent,
} from '../../../../shared/fixtures/ocpi-public.fixture';

const mockGetEvseStatus = getEvseStatus as jest.MockedFunction<
  typeof getEvseStatus
>;
const mockListEvseStatusesSince = listEvseStatusesSince as jest.MockedFunction<
  typeof listEvseStatusesSince
>;

const parseBody = (result: APIGatewayProxyResult) => JSON.parse(result.body);

describe('public status handlers', () => {
  beforeEach(() => jest.resetAllMocks());

  describe('GET /ocpi/status/{country_code}/{party_id}/{location_id}/evses/{evse_uid}', () => {
    it('returns status and last_updated', async () => {
      mockGetEvseStatus.mockResolvedValue({
        status: 'AVAILABLE',
        last_updated: '2026-08-20T15:36:40Z',
      });

      const result = await getStatus(buildStatusGetEvent());

      expect(result.statusCode).toBe(200);
      expect(parseBody(result).data).toEqual({
        status: 'AVAILABLE',
        last_updated: '2026-08-20T15:36:40Z',
      });
      expect(mockGetEvseStatus).toHaveBeenCalledWith(
        'CH',
        'GFS',
        '78594',
        '251674',
      );
    });

    it('returns 404 / 2003 for an EVSE without status', async () => {
      mockGetEvseStatus.mockResolvedValue(null);

      const result = await getStatus(buildStatusGetEvent());

      expect(result.statusCode).toBe(404);
      expect(parseBody(result)).toMatchObject({
        status_code: 2003,
        status_message: 'EVSE status not found',
      });
    });

    it('rejects an invalid evse_uid', async () => {
      const result = await getStatus(
        buildStatusGetEvent('CH', 'GFS', '78594', 'a#b'),
      );

      expect(result.statusCode).toBe(400);
      expect(mockGetEvseStatus).not.toHaveBeenCalled();
    });
  });

  describe('GET /ocpi/status', () => {
    it('lists statuses since date_from in received_at format, without pagination headers', async () => {
      mockListEvseStatusesSince.mockResolvedValue([]);

      const result = await listStatuses(
        buildStatusListEvent({
          date_from: '2026-08-20T15:30:00Z',
          limit: '100',
        }),
      );

      expect(result.statusCode).toBe(200);
      expect(parseBody(result).data).toEqual([]);
      expect(mockListEvseStatusesSince).toHaveBeenCalledWith(
        '2026-08-20T15:30:00.000Z',
        100,
      );
      expect(result.headers).not.toHaveProperty('Link');
      expect(result.headers).not.toHaveProperty('X-Total-Count');
    });

    it('defaults limit to 1000', async () => {
      mockListEvseStatusesSince.mockResolvedValue([]);

      await listStatuses(
        buildStatusListEvent({ date_from: '2026-08-20T15:30:00Z' }),
      );

      expect(mockListEvseStatusesSince).toHaveBeenCalledWith(
        '2026-08-20T15:30:00.000Z',
        1000,
      );
    });

    it('requires date_from', async () => {
      const result = await listStatuses(buildStatusListEvent());

      expect(result.statusCode).toBe(400);
      expect(parseBody(result).status_message).toBe('date_from is required');
    });

    it('rejects offset - the endpoint is not paginated', async () => {
      const result = await listStatuses(
        buildStatusListEvent({
          date_from: '2026-08-20T15:30:00Z',
          offset: '10',
        }),
      );

      expect(result.statusCode).toBe(400);
      expect(mockListEvseStatusesSince).not.toHaveBeenCalled();
    });
  });
});
