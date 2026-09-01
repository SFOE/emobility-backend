const mockSend = jest.fn();

jest.mock('@aws-sdk/client-sqs', () => ({
  SQSClient: jest.fn(() => ({ send: mockSend })),
  SendMessageCommand: jest.fn((input) => ({ input })),
}));

import { publishIngestionEvent, buildRawDataRecord } from '/opt/nodejs/aws/sqs';
import type { IngestionEvent, IngestionEventInput } from '/opt/nodejs/aws/sqs';

const baseInput = (
  over: Partial<IngestionEventInput>,
): IngestionEventInput => ({
  action: 'PUT',
  type: 'locations',
  country_code: 'CH',
  party_id: 'ABC',
  ocpi_version: '2.2.1',
  received_at: '2026-01-01T00:00:00.000Z',
  raw: null,
  ...over,
});

describe('publishIngestionEvent — derives object_id from the path ids', () => {
  beforeEach(() => {
    mockSend.mockReset().mockResolvedValue({});
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  const publishedBody = (): Record<string, unknown> => {
    const command = mockSend.mock.calls[0][0] as {
      input: { MessageBody: string };
    };
    return JSON.parse(command.input.MessageBody);
  };

  it('locations: object_id equals location_id', async () => {
    await publishIngestionEvent(
      baseInput({ type: 'locations', location_id: 'LOC1' }),
    );

    const body = publishedBody();
    expect(body.object_id).toBe('LOC1');
    expect(body.location_id).toBe('LOC1');
  });

  it('evse: object_id is location_id*evse_uid', async () => {
    await publishIngestionEvent(
      baseInput({ type: 'evse', location_id: 'LOC1', evse_uid: 'E1' }),
    );

    const body = publishedBody();
    expect(body.object_id).toBe('LOC1*E1');
    expect(body.location_id).toBe('LOC1');
    expect(body.evse_uid).toBe('E1');
  });

  it('connector: object_id is location_id*evse_uid*connector_id', async () => {
    await publishIngestionEvent(
      baseInput({
        type: 'connector',
        location_id: 'LOC1',
        evse_uid: 'E1',
        connector_id: 'C1',
      }),
    );

    const body = publishedBody();
    expect(body.object_id).toBe('LOC1*E1*C1');
    expect(body.connector_id).toBe('C1');
  });

  it('tariffs: object_id equals tariff_id', async () => {
    await publishIngestionEvent(
      baseInput({ type: 'tariffs', tariff_id: 'T1' }),
    );

    const body = publishedBody();
    expect(body.object_id).toBe('T1');
    expect(body.tariff_id).toBe('T1');
  });
});

describe('buildRawDataRecord — carries the path ids into the Landing Zone record', () => {
  it('includes object_id and the individual ids alongside the payload', () => {
    const event: IngestionEvent = {
      action: 'PATCH',
      type: 'connector',
      object_id: 'LOC1*E1*C1',
      location_id: 'LOC1',
      evse_uid: 'E1',
      connector_id: 'C1',
      country_code: 'CH',
      party_id: 'ABC',
      ocpi_version: '2.2.1',
      received_at: '2026-01-01T00:00:00.000Z',
      raw: null,
    };

    const record = buildRawDataRecord(event, { a: 1 });

    expect(record).toMatchObject({
      object_id: 'LOC1*E1*C1',
      location_id: 'LOC1',
      evse_uid: 'E1',
      connector_id: 'C1',
      payload: { a: 1 },
    });
  });
});
