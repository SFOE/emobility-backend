jest.mock('/opt/nodejs/aws/dynamodb');

import {
  batchGetItems,
  getItem,
  queryBySk,
  queryItems,
} from '/opt/nodejs/aws/dynamodb';
import {
  getEvseStatus,
  getPublicObject,
  listEvseStatusesSince,
  listPublicObjects,
} from '/opt/nodejs/modules/ocpi-public/ocpi-public.db';
import {
  PUBLIC_LOCATIONS,
  PUBLIC_TARIFFS,
} from '/opt/nodejs/modules/ocpi-public/ocpi-public.model';
import { MAX_PAGE_BODY_BYTES } from '/opt/nodejs/modules/ocpi-public/ocpi-public.params';

const mockGetItem = getItem as jest.MockedFunction<typeof getItem>;
const mockQueryItems = queryItems as jest.MockedFunction<typeof queryItems>;
const mockBatchGetItems = batchGetItems as jest.MockedFunction<
  typeof batchGetItems
>;
const mockQueryBySk = queryBySk as jest.MockedFunction<typeof queryBySk>;

const servingItem = (pk: string, seq = 0) => ({
  pk,
  body: JSON.stringify({ id: pk }),
  last_updated: '2026-08-01T10:00:00Z',
  seq,
});

describe('getPublicObject', () => {
  beforeEach(() => jest.resetAllMocks());

  it('reads the item by its typed pk', async () => {
    mockGetItem.mockResolvedValue(servingItem('TARIFF#CH#ABC#T1'));

    const body = await getPublicObject(PUBLIC_TARIFFS, 'CH', 'ABC', 'T1');

    expect(body).toBe(JSON.stringify({ id: 'TARIFF#CH#ABC#T1' }));
    expect(mockGetItem).toHaveBeenCalledWith('ocpi-tariffs', {
      TableName: 'ocpi-tariffs',
      Key: { pk: 'TARIFF#CH#ABC#T1' },
    });
  });

  it('returns null when the object is not served', async () => {
    mockGetItem.mockResolvedValue(undefined);

    expect(
      await getPublicObject(PUBLIC_LOCATIONS, 'CH', 'ABC', 'LOC-404'),
    ).toBeNull();
  });
});

describe('listPublicObjects by offset', () => {
  beforeEach(() => jest.resetAllMocks());

  it('queries GSI1 from the numeric offset and takes the total from #META', async () => {
    mockGetItem.mockResolvedValue({ pk: '#META', item_count: 250 });
    mockQueryItems.mockResolvedValue([
      servingItem('LOCATION#CH#ABC#A', 100),
      servingItem('LOCATION#CH#ABC#B', 101),
    ]);

    const page = await listPublicObjects(PUBLIC_LOCATIONS, {
      offset: 100,
      limit: 2,
    });

    expect(mockGetItem).toHaveBeenCalledWith('ocpi-locations', {
      TableName: 'ocpi-locations',
      Key: { pk: '#META' },
    });
    expect(mockQueryItems).toHaveBeenCalledWith(
      {
        TableName: 'ocpi-locations',
        IndexName: 'gsi1',
        KeyConditionExpression: 'gsi1pk = :type AND seq >= :offset',
        ExpressionAttributeValues: {
          ':type': 'LOCATION',
          ':offset': 100,
        },
      },
      2,
    );
    expect(page.total).toBe(250);
    expect(page.bodies.map((body) => JSON.parse(body).id)).toEqual([
      'LOCATION#CH#ABC#A',
      'LOCATION#CH#ABC#B',
    ]);
  });

  it('skips the query past the end or without #META', async () => {
    mockGetItem.mockResolvedValueOnce({ pk: '#META', item_count: 10 });
    expect(
      await listPublicObjects(PUBLIC_LOCATIONS, { offset: 10, limit: 5 }),
    ).toEqual({ bodies: [], total: 10 });

    mockGetItem.mockResolvedValueOnce(undefined);
    expect(
      await listPublicObjects(PUBLIC_LOCATIONS, { offset: 0, limit: 5 }),
    ).toEqual({ bodies: [], total: 0 });

    expect(mockQueryItems).not.toHaveBeenCalled();
  });

  it('cuts a page at the size budget but always keeps the first body', async () => {
    const big = 'x'.repeat(MAX_PAGE_BODY_BYTES - 10);
    mockGetItem.mockResolvedValue({ pk: '#META', item_count: 3 });
    mockQueryItems.mockResolvedValue([
      { ...servingItem('A'), body: big },
      { ...servingItem('B'), body: 'y'.repeat(100) },
      { ...servingItem('C'), body: 'z' },
    ]);

    const page = await listPublicObjects(PUBLIC_LOCATIONS, {
      offset: 0,
      limit: 3,
    });

    expect(page.bodies).toEqual([big]);
    expect(page.total).toBe(3);
  });
});

describe('listPublicObjects by date_from', () => {
  beforeEach(() => jest.resetAllMocks());

  it('reads the GSI2 key range, skips offset and returns bodies in GSI2 order', async () => {
    mockQueryItems.mockResolvedValue([
      { pk: 'T#1' },
      { pk: 'T#2' },
      { pk: 'T#3' },
      { pk: 'T#4' },
    ]);
    // BatchGetItem returns unordered and may miss a key swept meanwhile.
    mockBatchGetItems.mockResolvedValue([
      servingItem('T#3'),
      servingItem('T#2'),
    ]);

    const page = await listPublicObjects(PUBLIC_TARIFFS, {
      offset: 1,
      limit: 3,
      dateFrom: '2026-08-20T15:30:00Z',
    });

    expect(mockQueryItems).toHaveBeenCalledWith({
      TableName: 'ocpi-tariffs',
      IndexName: 'gsi2',
      KeyConditionExpression: 'gsi2pk = :type AND gsi2sk >= :dateFrom',
      ExpressionAttributeValues: {
        ':type': 'TARIFF',
        ':dateFrom': '2026-08-20T15:30:00Z',
      },
      ProjectionExpression: 'pk',
    });
    expect(mockBatchGetItems).toHaveBeenCalledWith('ocpi-tariffs', [
      { pk: 'T#2' },
      { pk: 'T#3' },
      { pk: 'T#4' },
    ]);
    expect(page.total).toBe(4);
    expect(page.bodies.map((body) => JSON.parse(body).id)).toEqual([
      'T#2',
      'T#3',
    ]);
    expect(mockGetItem).not.toHaveBeenCalled();
  });

  it('fetches nothing when offset is past the range', async () => {
    mockQueryItems.mockResolvedValue([{ pk: 'T#1' }]);

    const page = await listPublicObjects(PUBLIC_TARIFFS, {
      offset: 5,
      limit: 10,
      dateFrom: '2026-08-20T15:30:00Z',
    });

    expect(page).toEqual({ bodies: [], total: 1 });
    expect(mockBatchGetItems).not.toHaveBeenCalled();
  });
});

describe('EVSE status', () => {
  beforeEach(() => jest.resetAllMocks());

  it('returns only status and last_updated of one EVSE', async () => {
    mockQueryBySk.mockResolvedValue({
      pk: 'LOCATION#CH#GFS#78594',
      sk: 'EVSE#251674',
      status: 'AVAILABLE',
      last_updated: '2026-08-20T15:36:40Z',
      received_at: '2026-08-20T15:36:41.000Z',
    });

    expect(await getEvseStatus('CH', 'GFS', '78594', '251674')).toEqual({
      status: 'AVAILABLE',
      last_updated: '2026-08-20T15:36:40Z',
    });
    expect(mockQueryBySk).toHaveBeenCalledWith(
      'ocpi-evse-current-status',
      'LOCATION#CH#GFS#78594',
      'EVSE#251674',
    );
  });

  it('returns null for an EVSE without status', async () => {
    mockQueryBySk.mockResolvedValue(null);

    expect(await getEvseStatus('CH', 'GFS', '78594', 'X')).toBeNull();
  });

  it('lists statuses since date_from with their keys parsed back', async () => {
    mockQueryItems.mockResolvedValue([
      {
        pk: 'LOCATION#CH#GFS#78594',
        sk: 'EVSE#251674',
        status: 'CHARGING',
        last_updated: '2026-08-20T15:36:40Z',
        received_at: '2026-08-20T15:36:41.000Z',
      },
    ]);

    const statuses = await listEvseStatusesSince(
      '2026-08-20T15:30:00.000Z',
      100,
    );

    expect(mockQueryItems).toHaveBeenCalledWith(
      {
        TableName: 'ocpi-evse-current-status',
        IndexName: 'gsi1',
        KeyConditionExpression: 'gsi1pk = :type AND gsi1sk >= :dateFrom',
        ExpressionAttributeValues: {
          ':type': 'EVSE_STATUS',
          ':dateFrom': '2026-08-20T15:30:00.000Z',
        },
      },
      100,
    );
    expect(statuses).toEqual([
      {
        country_code: 'CH',
        party_id: 'GFS',
        location_id: '78594',
        evse_uid: '251674',
        status: 'CHARGING',
        last_updated: '2026-08-20T15:36:40Z',
      },
    ]);
  });
});
