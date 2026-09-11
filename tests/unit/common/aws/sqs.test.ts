const mockSend = jest.fn();

jest.mock('@aws-sdk/client-sqs', () => ({
  SQSClient: jest.fn(() => ({ send: mockSend })),
  SendMessageCommand: jest.fn((input) => ({ input })),
}));

import { publishIngestionEvent, buildRawDataRecord } from '/opt/nodejs/aws/sqs';
import type { IngestionEvent } from '/opt/nodejs/aws/sqs';

const baseEvent = (over: Partial<IngestionEvent>): IngestionEvent => ({
  action: 'PUT',
  type: 'locations',
  country_code: 'CH',
  party_id: 'ABC',
  ocpi_version: '2.2.1',
  received_at: '2026-01-01T00:00:00.000Z',
  raw: null,
  ...over,
});

describe('publishIngestionEvent — carries the path ids in the SQS message', () => {
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

  it('locations: publishes location_id', async () => {
    await publishIngestionEvent(
      baseEvent({ type: 'locations', location_id: 'LOC1' }),
    );

    expect(publishedBody().location_id).toBe('LOC1');
  });

  it('evse: publishes location_id and evse_uid', async () => {
    await publishIngestionEvent(
      baseEvent({ type: 'evse', location_id: 'LOC1', evse_uid: 'E1' }),
    );

    const body = publishedBody();
    expect(body.location_id).toBe('LOC1');
    expect(body.evse_uid).toBe('E1');
  });

  it('connector: publishes location_id, evse_uid and connector_id', async () => {
    await publishIngestionEvent(
      baseEvent({
        type: 'connector',
        location_id: 'LOC1',
        evse_uid: 'E1',
        connector_id: 'C1',
      }),
    );

    const body = publishedBody();
    expect(body.location_id).toBe('LOC1');
    expect(body.evse_uid).toBe('E1');
    expect(body.connector_id).toBe('C1');
  });

  it('tariffs: publishes tariff_id', async () => {
    await publishIngestionEvent(baseEvent({ type: 'tariffs', tariff_id: 'T1' }));

    expect(publishedBody().tariff_id).toBe('T1');
  });
});

describe('buildRawDataRecord — carries the path ids into the Landing Zone record', () => {
  it('includes the individual ids alongside the payload', () => {
    const event: IngestionEvent = {
      action: 'PATCH',
      type: 'connector',
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
      location_id: 'LOC1',
      evse_uid: 'E1',
      connector_id: 'C1',
      payload: { a: 1 },
    });
  });
});
