import { extractToken, getPartnerId } from '../../../../src/common/utils/ocpi-utils';
import {
  OCPICredentialItem,
} from '../../../../src/common/modules/ocpi-credentials/ocpi-credentials.model';

describe('test getPartnerId', () => {
  it('returns CPO role if present', () => {
    const credentialsItem = {
      roles: [
        { role: 'EMSP', party_id: 'ABC', country_code: 'DE' },
        { role: 'CPO', party_id: 'XYZ', country_code: 'CH' },
      ],
    } as OCPICredentialItem;

    const result = getPartnerId(credentialsItem);

    expect(result).toBe('CPO-XYZ-CH');
  });

  it('falls back to first role if no CPO exists', () => {
    const credentialsItem = {
      roles: [{ role: 'EMSP', party_id: 'ABC', country_code: 'DE' }],
    } as OCPICredentialItem;

    const result = getPartnerId(credentialsItem);

    expect(result).toBe('EMSP-ABC-DE');
  });

  it('returns unknown if roles is empty', () => {
    const credentials = {
      bootstrapToken: true,
    } as OCPICredentialItem;

    const result = getPartnerId(credentials);

    expect(result).toBe('unknown');
  });

  it('returns unknown if roles is missing', () => {
    const credentials = {} as OCPICredentialItem;

    const result = getPartnerId(credentials);

    expect(result).toBe('unknown');
  });
});

describe('test extractToken', () => {
  it('should return null if no header is provided', () => {
    expect(extractToken()).toBeNull();
    expect(extractToken(undefined)).toBeNull();
  });

  it('should return null if header does not match pattern', () => {
    expect(extractToken('Bearer abc123')).toBeNull();
    expect(extractToken('Token')).toBeNull();
    expect(extractToken('')).toBeNull();
  });

  it('should extract token correctly', () => {
    expect(extractToken('Token abc123')).toBe('abc123');
  });

  it('should be case insensitive', () => {
    expect(extractToken('token abc123')).toBe('abc123');
    expect(extractToken('TOKEN abc123')).toBe('abc123');
  });

  it('should trim whitespace around token', () => {
    expect(extractToken('Token    abc123   ')).toBe('abc123');
  });
});
