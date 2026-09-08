import {
  assertBodyConsistency,
  assertContextComplete,
  assertIsBootstrap,
  assertNotBootstrap,
  assertRole,
  assertValidPathIdentifiers,
  getRequiredBaseUrl,
  parsePathParams,
  parseRequestBody,
  validateCredentialsPayload,
  withVersionCheck,
} from '/opt/nodejs/utils/ocpi-guards';
import { OCPIAuthorizerContext } from '/opt/nodejs/api/base.model';

function parseBody(result: { body: string }) {
  return JSON.parse(result.body);
}

describe('assertIsBootstrap', () => {
  it('returns null when token is a bootstrap token', () => {
    const ctx = {
      isBootstrap: true,
      partnerId: 'test',
    } as OCPIAuthorizerContext;
    expect(assertIsBootstrap(ctx, 'test')).toBeNull();
  });

  it('returns 405 with OCPI 2000 when token is not a bootstrap token', () => {
    const ctx = {
      isBootstrap: false,
      partnerId: 'test',
    } as OCPIAuthorizerContext;
    const result = assertIsBootstrap(ctx, 'test');
    expect(result?.statusCode).toBe(405);
    expect(parseBody(result!).status_code).toBe(2000);
  });
});

describe('assertNotBootstrap', () => {
  it('returns null when token is not a bootstrap token', () => {
    const ctx = {
      isBootstrap: false,
      partnerId: 'test',
    } as OCPIAuthorizerContext;
    expect(assertNotBootstrap(ctx, 'test')).toBeNull();
  });

  it('returns 405 with OCPI 2000 when token is a bootstrap token', () => {
    const ctx = {
      isBootstrap: true,
      partnerId: 'test',
    } as OCPIAuthorizerContext;
    const result = assertNotBootstrap(ctx, 'test');
    expect(result?.statusCode).toBe(405);
    expect(parseBody(result!).status_code).toBe(2000);
  });
});

describe('assertContextComplete', () => {
  it('returns null when secretRef and credentialPk are both present', () => {
    const ctx = {
      isBootstrap: false,
      partnerId: 'test',
      secretRef: 'arn:secret',
      credentialPk: 'TOKEN#hash',
    } as OCPIAuthorizerContext;
    expect(assertContextComplete(ctx, 'test')).toBeNull();
  });

  it('returns 403 with OCPI 2000 when secretRef is missing', () => {
    const ctx = {
      isBootstrap: false,
      partnerId: 'test',
      credentialPk: 'TOKEN#hash',
    } as OCPIAuthorizerContext;
    const result = assertContextComplete(ctx, 'test');
    expect(result?.statusCode).toBe(403);
    expect(parseBody(result!).status_code).toBe(2000);
  });

  it('returns 403 with OCPI 2000 when credentialPk is missing', () => {
    const ctx = {
      isBootstrap: false,
      partnerId: 'test',
      secretRef: 'arn:secret',
    } as OCPIAuthorizerContext;
    const result = assertContextComplete(ctx, 'test');
    expect(result?.statusCode).toBe(403);
    expect(parseBody(result!).status_code).toBe(2000);
  });
});

describe('assertRole', () => {
  it.each(['CPO', 'EMSP', 'NAP', 'NSP', 'OTHER', 'SCSP'])(
    'returns null for valid OCPI role %s',
    (role) => {
      const ctx = {
        isBootstrap: false,
        partnerId: 'test',
        role,
      } as OCPIAuthorizerContext;
      expect(assertRole(ctx, 'test')).toBeNull();
    },
  );

  it('returns 405 with OCPI 2000 when role is not a valid OCPI role', () => {
    const ctx = {
      isBootstrap: false,
      partnerId: 'test',
      role: 'INVALID',
    } as unknown as OCPIAuthorizerContext;
    const result = assertRole(ctx, 'test');
    expect(result?.statusCode).toBe(405);
    expect(parseBody(result!).status_code).toBe(2000);
  });
});

describe('assertBodyConsistency', () => {
  const body = { country_code: 'DE', party_id: 'XYZ', id: 'T01' };

  it('returns null when path and body identifiers all match', () => {
    expect(
      assertBodyConsistency(body, 'DE', 'XYZ', 'T01', 'test', 'CPO-XYZ-DE'),
    ).toBeNull();
  });

  it('returns 400 with OCPI 2001 when country_code does not match', () => {
    const result = assertBodyConsistency(
      body,
      'CH',
      'XYZ',
      'T01',
      'test',
      'CPO-XYZ-DE',
    );
    expect(result?.statusCode).toBe(400);
    expect(parseBody(result!).status_code).toBe(2001);
  });

  it('returns 400 with OCPI 2001 when party_id does not match', () => {
    const result = assertBodyConsistency(
      body,
      'DE',
      'ABC',
      'T01',
      'test',
      'CPO-XYZ-DE',
    );
    expect(result?.statusCode).toBe(400);
    expect(parseBody(result!).status_code).toBe(2001);
  });

  it('returns 400 with OCPI 2001 when id does not match', () => {
    const result = assertBodyConsistency(
      body,
      'DE',
      'XYZ',
      'T99',
      'test',
      'CPO-XYZ-DE',
    );
    expect(result?.statusCode).toBe(400);
    expect(parseBody(result!).status_code).toBe(2001);
  });

  it('returns null when country_code/party_id differ only in case (CiString)', () => {
    expect(
      assertBodyConsistency(
        { country_code: 'de', party_id: 'xyz', id: 'T01' },
        'DE',
        'XYZ',
        'T01',
        'test',
        'CPO-XYZ-DE',
      ),
    ).toBeNull();
  });

  it('still rejects when only the id differs by case (id is compared exactly)', () => {
    const result = assertBodyConsistency(
      { country_code: 'DE', party_id: 'XYZ', id: 't01' },
      'DE',
      'XYZ',
      'T01',
      'test',
      'CPO-XYZ-DE',
    );
    expect(result?.statusCode).toBe(400);
    expect(parseBody(result!).status_code).toBe(2001);
  });
});

describe('assertValidPathIdentifiers', () => {
  const ok = {
    country_code: 'CH',
    party_id: 'ABC',
    location_id: 'LOC001',
    evse_uid: 'CH*ABC*E1',
    connector_id: '1',
    tariff_id: 'TARIFF-001',
  };

  it('returns null for valid identifiers (incl. * - . which OCPI allows)', () => {
    expect(assertValidPathIdentifiers(ok, 'test', 'CPO-ABC-CH')).toBeNull();
  });

  it('skips fields not present on the route (undefined)', () => {
    expect(
      assertValidPathIdentifiers(
        { country_code: 'CH', party_id: 'ABC' },
        'test',
        'p',
      ),
    ).toBeNull();
  });

  it.each(['a/b', 'a#b', 'k=v', 'a b', ' ', 'LOC\t1'])(
    'rejects a location_id containing key-breaking char %p',
    (bad) => {
      const result = assertValidPathIdentifiers(
        { ...ok, location_id: bad },
        'test',
        'p',
      );
      expect(result?.statusCode).toBe(400);
      expect(parseBody(result!).status_code).toBe(2001);
    },
  );

  it('rejects country_code that is not exactly 2 chars', () => {
    expect(
      assertValidPathIdentifiers({ ...ok, country_code: 'CHE' }, 'test', 'p')
        ?.statusCode,
    ).toBe(400);
    expect(
      assertValidPathIdentifiers({ ...ok, country_code: 'C' }, 'test', 'p')
        ?.statusCode,
    ).toBe(400);
  });

  it('rejects party_id that is not exactly 3 chars', () => {
    expect(
      assertValidPathIdentifiers({ ...ok, party_id: 'AB' }, 'test', 'p')
        ?.statusCode,
    ).toBe(400);
  });

  it('rejects a resource id longer than 36 chars or empty', () => {
    expect(
      assertValidPathIdentifiers(
        { ...ok, tariff_id: 'x'.repeat(37) },
        'test',
        'p',
      )?.statusCode,
    ).toBe(400);
    expect(
      assertValidPathIdentifiers({ ...ok, location_id: '' }, 'test', 'p')
        ?.statusCode,
    ).toBe(400);
  });
});

describe('parseRequestBody', () => {
  it('returns success with parsed data for valid JSON', () => {
    const result = parseRequestBody<{ key: string }>('{"key":"value"}');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ key: 'value' });
    }
  });

  it('returns failure with 400 and OCPI 2001 when body is missing', () => {
    const result = parseRequestBody(undefined);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.statusCode).toBe(400);
      expect(parseBody(result.error).status_code).toBe(2001);
    }
  });

  it('returns failure with 400 and OCPI 2001 when body is invalid JSON', () => {
    const result = parseRequestBody('{not-json}');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.statusCode).toBe(400);
      expect(parseBody(result.error).status_code).toBe(2001);
    }
  });
});

describe('validateCredentialsPayload', () => {
  const validRole = {
    role: 'CPO',
    party_id: 'XYZ',
    country_code: 'DE',
    business_details: { name: 'Test CPO' },
  };
  const validCredentials = {
    token: 'TOKEN_B',
    roles: [validRole],
    url: 'https://cpo.example.com',
  };

  it('returns null for a valid payload', () => {
    expect(
      validateCredentialsPayload(validCredentials as any, validRole as any),
    ).toBeNull();
  });

  it('returns an error when token is missing', () => {
    expect(
      validateCredentialsPayload(
        { ...validCredentials, token: '' } as any,
        validRole as any,
      ),
    ).not.toBeNull();
  });

  it('returns an error when roles array is empty', () => {
    expect(
      validateCredentialsPayload(
        { ...validCredentials, roles: [] } as any,
        undefined,
      ),
    ).not.toBeNull();
  });

  it('returns an error when primary role is undefined', () => {
    expect(
      validateCredentialsPayload(validCredentials as any, undefined),
    ).not.toBeNull();
  });

  it('returns an error when role field is missing', () => {
    expect(
      validateCredentialsPayload(
        validCredentials as any,
        { ...validRole, role: '' } as any,
      ),
    ).not.toBeNull();
  });

  it('returns an error when party_id is not 3 printable ASCII characters', () => {
    expect(
      validateCredentialsPayload(
        validCredentials as any,
        { ...validRole, party_id: 'XX' } as any,
      ),
    ).not.toBeNull();
  });

  it('returns an error when country_code is not 2 printable ASCII characters', () => {
    expect(
      validateCredentialsPayload(
        validCredentials as any,
        { ...validRole, country_code: 'D' } as any,
      ),
    ).not.toBeNull();
  });

  it('returns an error when business_details.name is missing', () => {
    expect(
      validateCredentialsPayload(
        validCredentials as any,
        { ...validRole, business_details: {} } as any,
      ),
    ).not.toBeNull();
  });
});

describe('getRequiredBaseUrl', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('returns BASE_URL when set', () => {
    process.env.BASE_URL = 'https://bfe.example.com';
    expect(getRequiredBaseUrl()).toBe('https://bfe.example.com');
  });

  it('throws when BASE_URL is not set', () => {
    delete process.env.BASE_URL;
    expect(() => getRequiredBaseUrl()).toThrow();
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

describe('withVersionCheck', () => {
  function buildEvent(
    version: string,
    authContext: Partial<OCPIAuthorizerContext> = {},
  ) {
    return {
      requestContext: { authorizer: { lambda: authContext } },
      pathParameters: { version },
    } as any;
  }

  it('returns 400 with OCPI 3002 for an unsupported version', async () => {
    const wrappedHandler = withVersionCheck()(jest.fn());
    const result = await wrappedHandler(buildEvent('1.0'));
    expect(result.statusCode).toBe(400);
    expect(parseBody(result).status_code).toBe(3002);
  });

  it('calls the handler with event, authContext, and version for a supported version', async () => {
    const mockHandler = jest
      .fn()
      .mockResolvedValue({ statusCode: 200, body: '{}' });
    const authContext = { isBootstrap: false };
    const wrappedHandler = withVersionCheck()(mockHandler);
    await wrappedHandler(buildEvent('2.2.1', authContext));
    expect(mockHandler).toHaveBeenCalledWith(
      expect.anything(),
      authContext,
      '2.2.1',
      expect.anything(),
    );
  });

  it('returns the guard result and does not call the handler when the guard rejects', async () => {
    const guardResult = { statusCode: 405, body: '{}', headers: {} };
    const guard = jest.fn().mockReturnValue(guardResult);
    const mockHandler = jest.fn();
    const wrappedHandler = withVersionCheck(guard)(mockHandler);
    const result = await wrappedHandler(buildEvent('2.2.1'));
    expect(result).toBe(guardResult);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('calls the handler when the guard passes', async () => {
    const guard = jest.fn().mockReturnValue(null);
    const mockHandler = jest
      .fn()
      .mockResolvedValue({ statusCode: 200, body: '{}' });
    const wrappedHandler = withVersionCheck(guard)(mockHandler);
    await wrappedHandler(buildEvent('2.2.1'));
    expect(mockHandler).toHaveBeenCalled();
  });
});
