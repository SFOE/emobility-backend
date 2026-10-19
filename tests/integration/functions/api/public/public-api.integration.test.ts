// globalSetup sets AWS_ENDPOINT_URL_* before workers spawn, so static SDK clients already point to Ministack.
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  CreateTableCommand,
  DynamoDBClient,
  ResourceInUseException,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { handler as getLocation } from '../../../../../src/functions/api/public/locations/public-locations-get';
import { handler as listLocations } from '../../../../../src/functions/api/public/locations/public-locations-list';
import { handler as listTariffs } from '../../../../../src/functions/api/public/tariffs/public-tariffs-list';
import { handler as getStatus } from '../../../../../src/functions/api/public/status/public-status-get';
import { handler as listStatuses } from '../../../../../src/functions/api/public/status/public-status-list';
import { Aws } from '/opt/nodejs/aws/constants';
import {
  buildLocationGetEvent,
  buildLocationsListEvent,
  buildStatusGetEvent,
  buildStatusListEvent,
  buildTariffsListEvent,
} from '../../../../shared/fixtures/ocpi-public.fixture';

const dynamoClient = new DynamoDBClient({ region: Aws.region });
const dynamoDoc = DynamoDBDocument.from(dynamoClient);

const parseBody = (result: APIGatewayProxyResult) => JSON.parse(result.body);

// Same layout the Glue job's ocpi_public_api.py writes and tf-dynamodb defines.
async function createServingTable(tableName: string): Promise<void> {
  try {
    await dynamoClient.send(
      new CreateTableCommand({
        TableName: tableName,
        BillingMode: 'PAY_PER_REQUEST',
        KeySchema: [{ AttributeName: 'pk', KeyType: 'HASH' }],
        AttributeDefinitions: ['pk', 'gsi1pk', 'seq', 'gsi2pk', 'gsi2sk'].map(
          (name) => ({ AttributeName: name, AttributeType: 'S' }),
        ),
        GlobalSecondaryIndexes: [
          {
            IndexName: 'gsi1',
            KeySchema: [
              { AttributeName: 'gsi1pk', KeyType: 'HASH' },
              { AttributeName: 'seq', KeyType: 'RANGE' },
            ],
            Projection: { ProjectionType: 'ALL' },
          },
          {
            IndexName: 'gsi2',
            KeySchema: [
              { AttributeName: 'gsi2pk', KeyType: 'HASH' },
              { AttributeName: 'gsi2sk', KeyType: 'RANGE' },
            ],
            Projection: { ProjectionType: 'KEYS_ONLY' },
          },
        ],
      }),
    );
  } catch (err) {
    if (!(err instanceof ResourceInUseException)) {
      throw err;
    }
  }
}

async function createStatusTable(): Promise<void> {
  try {
    await dynamoClient.send(
      new CreateTableCommand({
        TableName: Aws.dynamoDBTables.evseCurrentStatus,
        BillingMode: 'PAY_PER_REQUEST',
        KeySchema: [
          { AttributeName: 'pk', KeyType: 'HASH' },
          { AttributeName: 'sk', KeyType: 'RANGE' },
        ],
        AttributeDefinitions: ['pk', 'sk', 'gsi1pk', 'gsi1sk'].map((name) => ({
          AttributeName: name,
          AttributeType: 'S',
        })),
        GlobalSecondaryIndexes: [
          {
            IndexName: 'gsi1',
            KeySchema: [
              { AttributeName: 'gsi1pk', KeyType: 'HASH' },
              { AttributeName: 'gsi1sk', KeyType: 'RANGE' },
            ],
            Projection: { ProjectionType: 'ALL' },
          },
        ],
      }),
    );
  } catch (err) {
    if (!(err instanceof ResourceInUseException)) {
      throw err;
    }
  }
}

// Locations as the Glue job writes them: `seq` in list order (here deliberately not
// alphabetical, as after appends), last_updated spread over August.
const LOCATIONS = [
  { id: 'LOC-C', seq: 0, last_updated: '2026-08-05T10:00:00Z' },
  { id: 'LOC-A', seq: 1, last_updated: '2026-08-20T10:00:00Z' },
  { id: 'LOC-E', seq: 2, last_updated: '2026-08-01T10:00:00Z' },
  { id: 'LOC-B', seq: 3, last_updated: '2026-08-21T10:00:00Z' },
  { id: 'LOC-D', seq: 4, last_updated: '2026-08-10T10:00:00Z' },
];

async function seedServingTable(
  tableName: string,
  type: string,
  objects: { id: string; seq: number; last_updated: string }[],
): Promise<void> {
  for (const { id, seq, last_updated } of objects) {
    const pk = `${type}#CH#ABC#${id}`;
    await dynamoDoc.put({
      TableName: tableName,
      Item: {
        pk,
        body: JSON.stringify({
          country_code: 'CH',
          party_id: 'ABC',
          id,
          last_updated,
        }),
        last_updated,
        generation: '2026-10-01T02:00:00Z',
        gsi1pk: type,
        seq: String(seq).padStart(8, '0'),
        gsi2pk: type,
        gsi2sk: `${last_updated}#${pk}`,
      },
    });
  }
  await dynamoDoc.put({
    TableName: tableName,
    Item: {
      pk: '#META',
      item_count: objects.length,
      generation: '2026-10-01T02:00:00Z',
      built_at: '2026-10-01T02:00:00Z',
    },
  });
}

async function seedStatus(
  locationId: string,
  evseUid: string,
  status: string,
  receivedAt: string,
): Promise<void> {
  await dynamoDoc.put({
    TableName: Aws.dynamoDBTables.evseCurrentStatus,
    Item: {
      pk: `LOCATION#CH#GFS#${locationId}`,
      sk: `EVSE#${evseUid}`,
      status,
      last_updated: receivedAt.replace(/\.\d{3}Z$/, 'Z'),
      received_at: receivedAt,
      gsi1pk: 'EVSE_STATUS',
      gsi1sk: `${receivedAt}#CH#GFS#${locationId}#${evseUid}`,
    },
  });
}

const ids = (result: APIGatewayProxyResult): string[] =>
  parseBody(result).data.map((object: { id: string }) => object.id);

describe('public OCPI API integration', () => {
  beforeAll(async () => {
    process.env.BASE_URL =
      process.env.BASE_URL ?? 'https://bfe-integration-test.example.com';
    await createServingTable(Aws.dynamoDBTables.ocpiLocations);
    await createServingTable(Aws.dynamoDBTables.ocpiTariffs);
    await createStatusTable();
    await seedServingTable(
      Aws.dynamoDBTables.ocpiLocations,
      'LOCATION',
      LOCATIONS,
    );
    await seedServingTable(Aws.dynamoDBTables.ocpiTariffs, 'TARIFF', [
      { id: 'T1', seq: 0, last_updated: '2026-08-18T08:30:00Z' },
    ]);
    await seedStatus(
      '78594',
      '251674',
      'AVAILABLE',
      '2026-08-20T15:36:40.000Z',
    );
    await seedStatus('78594', '251675', 'CHARGING', '2026-08-20T15:36:41.000Z');
    await seedStatus('11111', '1', 'OUTOFORDER', '2026-08-19T09:00:00.000Z');
  });

  it('pages /locations by offset in seq order with OCPI headers', async () => {
    const first = await listLocations(buildLocationsListEvent({ limit: '2' }));
    const second = await listLocations(
      buildLocationsListEvent({ offset: '2', limit: '2' }),
    );
    const last = await listLocations(
      buildLocationsListEvent({ offset: '4', limit: '2' }),
    );

    expect(ids(first)).toEqual(['LOC-C', 'LOC-A']);
    expect(ids(second)).toEqual(['LOC-E', 'LOC-B']);
    expect(ids(last)).toEqual(['LOC-D']);
    expect(first.headers).toMatchObject({
      'X-Total-Count': '5',
      'X-Limit': '2',
    });
    expect(first.headers?.Link).toBe(
      `<${process.env.BASE_URL}/locations?offset=2&limit=2>; rel="next"`,
    );
    expect(last.headers).not.toHaveProperty('Link');
  });

  it('filters /locations by date_from on last_updated, oldest change first', async () => {
    const result = await listLocations(
      buildLocationsListEvent({
        date_from: '2026-08-10T10:00:00Z',
        limit: '2',
      }),
    );
    const next = await listLocations(
      buildLocationsListEvent({
        date_from: '2026-08-10T10:00:00Z',
        offset: '2',
        limit: '2',
      }),
    );

    expect(ids(result)).toEqual(['LOC-D', 'LOC-A']);
    expect(result.headers?.['X-Total-Count']).toBe('3');
    expect(ids(next)).toEqual(['LOC-B']);
    expect(next.headers).not.toHaveProperty('Link');
  });

  it('never lists the #META item', async () => {
    const result = await listLocations(buildLocationsListEvent());

    expect(ids(result)).toHaveLength(5);
    expect(ids(result)).not.toContain(undefined);
  });

  it('serves a single location and 404s on an unknown one', async () => {
    const found = await getLocation(
      buildLocationGetEvent('CH', 'ABC', 'LOC-A'),
    );
    const missing = await getLocation(
      buildLocationGetEvent('CH', 'ABC', 'LOC-X'),
    );

    expect(parseBody(found).data).toMatchObject({ id: 'LOC-A' });
    expect(missing.statusCode).toBe(404);
  });

  it('serves /tariffs from its own table', async () => {
    const result = await listTariffs(buildTariffsListEvent());

    expect(ids(result)).toEqual(['T1']);
    expect(result.headers?.['X-Total-Count']).toBe('1');
  });

  it('serves the live status of one EVSE', async () => {
    const result = await getStatus(
      buildStatusGetEvent('CH', 'GFS', '78594', '251674'),
    );

    expect(parseBody(result).data).toEqual({
      status: 'AVAILABLE',
      last_updated: '2026-08-20T15:36:40Z',
    });
  });

  it('lists statuses received since date_from', async () => {
    const result = await listStatuses(
      buildStatusListEvent({ date_from: '2026-08-20T15:30:00Z' }),
    );

    expect(parseBody(result).data).toEqual([
      {
        country_code: 'CH',
        party_id: 'GFS',
        location_id: '78594',
        evse_uid: '251674',
        status: 'AVAILABLE',
        last_updated: '2026-08-20T15:36:40Z',
      },
      {
        country_code: 'CH',
        party_id: 'GFS',
        location_id: '78594',
        evse_uid: '251675',
        status: 'CHARGING',
        last_updated: '2026-08-20T15:36:41Z',
      },
    ]);
  });
});
