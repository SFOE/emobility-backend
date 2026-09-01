import { buildLandingZoneKey } from '/opt/nodejs/aws/s3';

describe('buildLandingZoneKey', () => {
  const ts = new Date('2026-05-28T11:26:31.000Z');

  it('builds a Hive-partitioned key ending with the unique id and .jsonl.gz', () => {
    const key = buildLandingZoneKey(ts, 'req-abc-123');

    expect(key.startsWith('ocpi-raw/year=2026/month=05/day=28/')).toBe(true);
    expect(key.endsWith('-req-abc-123.jsonl.gz')).toBe(true);
  });

  it('produces distinct keys for the same timestamp with different unique ids', () => {
    // This is the core guarantee against concurrent invocations overwriting
    // each other's batch in the Landing Zone.
    const a = buildLandingZoneKey(ts, 'req-1');
    const b = buildLandingZoneKey(ts, 'req-2');

    expect(a).not.toEqual(b);
  });
});
