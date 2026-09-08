import {
  extractToken,
  getPartnerId,
  getPrimaryRole,
  parsePathParams,
} from '/opt/nodejs/utils/ocpi-utils';
import { OCPICredentialRole } from '/opt/nodejs/modules/ocpi-credentials/ocpi-credentials.model';
import { OCPICredentialItem } from '/opt/nodejs/modules/ocpi-credentials/ocpi-credentials.model';

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

describe('parsePathParams', () => {
  it('uppercases country_code and party_id and passes ids through unchanged', () => {
    const result = parsePathParams({
      pathParameters: {
        country_code: 'ch',
        party_id: 'abc',
        location_id: 'LOC001',
        evse_uid: 'EVSE001',
        connector_id: '1',
        tariff_id: 'TAR001',
      },
    });

    expect(result.country_code).toBe('CH');
    expect(result.party_id).toBe('ABC');
    expect(result.location_id).toBe('LOC001');
    expect(result.evse_uid).toBe('EVSE001');
    expect(result.connector_id).toBe('1');
    expect(result.tariff_id).toBe('TAR001');
  });

  it('returns undefined fields when pathParameters is missing or null', () => {
    expect(parsePathParams({}).country_code).toBeUndefined();
    expect(parsePathParams({ pathParameters: null }).party_id).toBeUndefined();
  });
});

describe('test getPrimaryRole', () => {
  it('returns the CPO role when present', () => {
    const roles: OCPICredentialRole[] = [
      {
        role: 'EMSP',
        party_id: 'ABC',
        country_code: 'DE',
        business_details: { name: 'Test EMSP' },
      },
      {
        role: 'CPO',
        party_id: 'XYZ',
        country_code: 'CH',
        business_details: { name: 'Test CPO' },
      },
    ];
    expect(getPrimaryRole(roles)).toEqual(roles[1]);
  });

  it('falls back to the first role when no CPO exists', () => {
    const roles: OCPICredentialRole[] = [
      {
        role: 'EMSP',
        party_id: 'ABC',
        country_code: 'DE',
        business_details: { name: 'Test EMSP' },
      },
    ];
    expect(getPrimaryRole(roles)).toEqual(roles[0]);
  });

  it('returns undefined when roles array is empty', () => {
    expect(getPrimaryRole([])).toBeUndefined();
  });
});
