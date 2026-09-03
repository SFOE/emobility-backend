jest.mock('/opt/nodejs/aws/dynamodb');

import { isEVSEStatus } from '/opt/nodejs/modules/ocpi-locations/ocpi-locations.model';

describe('isEVSEStatus', () => {
  it('accepts every OCPI EVSE status', () => {
    for (const status of [
      'AVAILABLE',
      'BLOCKED',
      'CHARGING',
      'INOPERATIVE',
      'OUTOFORDER',
      'PLANNED',
      'REMOVED',
      'RESERVED',
      'UNKNOWN',
    ]) {
      expect(isEVSEStatus(status)).toBe(true);
    }
  });

  it('rejects wrong case, typos, empty and non-strings', () => {
    expect(isEVSEStatus('available')).toBe(false);
    expect(isEVSEStatus('CHARGIN')).toBe(false);
    expect(isEVSEStatus('')).toBe(false);
    expect(isEVSEStatus(undefined)).toBe(false);
    expect(isEVSEStatus(42)).toBe(false);
  });
});
