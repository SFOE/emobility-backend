jest.mock('/opt/nodejs/modules/ocpi-public/ocpi-public.db');

import { APIGatewayProxyResult } from 'aws-lambda';
import { handler as getLocation } from '../../../../../src/functions/api/public/locations/locations-get';
import { handler as listLocations } from '../../../../../src/functions/api/public/locations/locations-list';
import { handler as getTariff } from '../../../../../src/functions/api/public/tariffs/tariffs-get';
import { handler as listTariffs } from '../../../../../src/functions/api/public/tariffs/tariffs-list';
import {
  getPublicObject,
  listPublicObjects,
} from '/opt/nodejs/modules/ocpi-public/ocpi-public.db';
import {
  PUBLIC_LOCATIONS,
  PUBLIC_TARIFFS,
} from '/opt/nodejs/modules/ocpi-public/ocpi-public.model';
import {
  buildLocationGetEvent,
  buildLocationsListEvent,
  buildTariffGetEvent,
  buildTariffsListEvent,
} from '../../../../shared/fixtures/ocpi-public.fixture';

const mockGetPublicObject = getPublicObject as jest.MockedFunction<
  typeof getPublicObject
>;
const mockListPublicObjects = listPublicObjects as jest.MockedFunction<
  typeof listPublicObjects
>;

const parseBody = (result: APIGatewayProxyResult) => JSON.parse(result.body);

const LOCATION = { country_code: 'CH', party_id: 'ABC', id: 'LOC-001' };

describe('public object handlers', () => {
  const previousBaseUrl = process.env.BASE_URL;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.BASE_URL = 'https://api.example.com';
  });

  afterAll(() => {
    process.env.BASE_URL = previousBaseUrl;
  });

  describe('GET /ocpi/locations/{country_code}/{party_id}/{location_id}', () => {
    it('returns the stored OCPI object as data', async () => {
      mockGetPublicObject.mockResolvedValue(JSON.stringify(LOCATION));

      const result = await getLocation(buildLocationGetEvent());

      expect(result.statusCode).toBe(200);
      expect(parseBody(result).status_code).toBe(1000);
      expect(parseBody(result).data).toEqual(LOCATION);
      expect(mockGetPublicObject).toHaveBeenCalledWith(
        PUBLIC_LOCATIONS,
        'CH',
        'ABC',
        'LOC-001',
      );
    });

    it('normalizes country_code and party_id to uppercase', async () => {
      mockGetPublicObject.mockResolvedValue(JSON.stringify(LOCATION));

      await getLocation(buildLocationGetEvent('ch', 'abc', 'LOC-001'));

      expect(mockGetPublicObject).toHaveBeenCalledWith(
        PUBLIC_LOCATIONS,
        'CH',
        'ABC',
        'LOC-001',
      );
    });

    it('returns 404 / 2003 for an unknown location', async () => {
      mockGetPublicObject.mockResolvedValue(null);

      const result = await getLocation(buildLocationGetEvent());

      expect(result.statusCode).toBe(404);
      expect(parseBody(result)).toMatchObject({
        status_code: 2003,
        status_message: 'Location not found',
      });
      expect(parseBody(result).data).toBeUndefined();
    });

    it('rejects an id with # before touching DynamoDB (keeps #META unreachable)', async () => {
      const result = await getLocation(
        buildLocationGetEvent('CH', 'ABC', '#META'),
      );

      expect(result.statusCode).toBe(400);
      expect(parseBody(result).status_code).toBe(2001);
      expect(mockGetPublicObject).not.toHaveBeenCalled();
    });

    it('returns 500 / 3000 when DynamoDB fails', async () => {
      mockGetPublicObject.mockRejectedValue(new Error('boom'));

      const result = await getLocation(buildLocationGetEvent());

      expect(result.statusCode).toBe(500);
      expect(parseBody(result).status_code).toBe(3000);
    });
  });

  describe('GET /ocpi/tariffs/{country_code}/{party_id}/{tariff_id}', () => {
    it('reads the tariffs table and says Tariff not found on a miss', async () => {
      mockGetPublicObject.mockResolvedValue(null);

      const result = await getTariff(buildTariffGetEvent());

      expect(mockGetPublicObject).toHaveBeenCalledWith(
        PUBLIC_TARIFFS,
        'CH',
        'ABC',
        'TARIFF-DC-01',
      );
      expect(parseBody(result).status_message).toBe('Tariff not found');
    });
  });

  describe('GET /ocpi/locations', () => {
    it('returns the page with OCPI pagination headers', async () => {
      mockListPublicObjects.mockResolvedValue({
        bodies: [JSON.stringify(LOCATION), JSON.stringify({ id: 'LOC-002' })],
        total: 5,
      });

      const result = await listLocations(
        buildLocationsListEvent({ offset: '2', limit: '2' }),
      );

      expect(result.statusCode).toBe(200);
      expect(parseBody(result).data).toEqual([LOCATION, { id: 'LOC-002' }]);
      expect(mockListPublicObjects).toHaveBeenCalledWith(PUBLIC_LOCATIONS, {
        offset: 2,
        limit: 2,
        dateFrom: undefined,
      });
      expect(result.headers).toMatchObject({
        'Content-Type': 'application/json',
        'X-Total-Count': '5',
        'X-Limit': '2',
        Link: '<https://api.example.com/ocpi/locations?offset=4&limit=2>; rel="next"',
      });
    });

    it('returns an empty array without Link on an empty table', async () => {
      mockListPublicObjects.mockResolvedValue({ bodies: [], total: 0 });

      const result = await listLocations(buildLocationsListEvent());

      expect(parseBody(result).data).toEqual([]);
      expect(result.headers).not.toHaveProperty('Link');
      expect(result.headers?.['X-Total-Count']).toBe('0');
    });

    it('rejects an invalid limit with 400 / 2001', async () => {
      const result = await listLocations(
        buildLocationsListEvent({ limit: '5000' }),
      );

      expect(result.statusCode).toBe(400);
      expect(parseBody(result)).toMatchObject({
        status_code: 2001,
        status_message: 'limit must be between 1 and 1000',
      });
      expect(mockListPublicObjects).not.toHaveBeenCalled();
    });
  });

  describe('GET /ocpi/tariffs', () => {
    it('passes a normalized date_from through and links with it', async () => {
      mockListPublicObjects.mockResolvedValue({
        bodies: [JSON.stringify({ id: 'T1' })],
        total: 2,
      });

      const result = await listTariffs(
        buildTariffsListEvent({
          date_from: '2026-08-20T15:30:00.250Z',
          limit: '1',
        }),
      );

      expect(mockListPublicObjects).toHaveBeenCalledWith(PUBLIC_TARIFFS, {
        offset: 0,
        limit: 1,
        dateFrom: '2026-08-20T15:30:00Z',
      });
      expect(result.headers?.Link).toBe(
        '<https://api.example.com/ocpi/tariffs?date_from=2026-08-20T15%3A30%3A00Z&offset=1&limit=1>; rel="next"',
      );
    });
  });
});
