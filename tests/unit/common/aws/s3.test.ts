const mockSend = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: mockSend })),
  PutObjectCommand: jest.fn((input) => ({ input })),
  GetObjectCommand: jest.fn((input) => ({ input })),
}));

import { buildLandingZoneKey, putRawToS3 } from '/opt/nodejs/aws/s3';

describe('buildLandingZoneKey', () => {
  const ts = new Date('2026-05-28T11:26:31.000Z');

  it('builds a Hive-partitioned key ending with the unique id and .jsonl.gz', () => {
    const key = buildLandingZoneKey(ts, 'req-abc-123');

    expect(key.startsWith('ocpi-raw/year=2026/month=05/day=28/')).toBe(true);
    expect(key.endsWith('-req-abc-123.jsonl.gz')).toBe(true);
  });

  it('produces distinct keys for the same timestamp with different unique ids', () => {
    // Core guarantee against concurrent invocations overwriting each other's batch.
    const a = buildLandingZoneKey(ts, 'req-1');
    const b = buildLandingZoneKey(ts, 'req-2');

    expect(a).not.toEqual(b);
  });
});

describe('putRawToS3 — unique key per write', () => {
  beforeEach(() => {
    mockSend.mockReset().mockResolvedValue({});
  });

  it('produces a distinct key for identical inputs so two writes never overwrite', async () => {
    const args = [
      'payload',
      'locations',
      'PUT',
      'CH',
      'ABC',
      ['location_id=LOC1'],
      '2026-01-01T00:00:00.000Z',
    ] as const;

    const k1 = await putRawToS3(...args);
    const k2 = await putRawToS3(...args);

    expect(k1).not.toEqual(k2);
    expect(k1).toMatch(
      /^locations\/year=2026\/month=01\/day=01\/country=CH\/party=ABC\/location_id=LOC1\/PUT_.+\.json$/,
    );
  });

  it('writes to S3 under exactly the key it returns', async () => {
    const key = await putRawToS3(
      'payload',
      'tariffs',
      'PUT',
      'DE',
      'XYZ',
      ['tariff_id=T1'],
      '2026-01-01T00:00:00.000Z',
    );

    expect(mockSend).toHaveBeenCalledTimes(1);
    const putInput = (mockSend.mock.calls[0][0] as { input: { Key: string } })
      .input;
    expect(putInput.Key).toBe(key);
  });
});
