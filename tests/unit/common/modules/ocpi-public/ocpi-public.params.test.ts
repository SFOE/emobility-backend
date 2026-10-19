import {
  buildPaginationHeaders,
  MAX_LIMIT,
  parseListQuery,
} from '/opt/nodejs/modules/ocpi-public/ocpi-public.params';

const BASE_URL = 'https://api.example.com';

const errorOf = (result: ReturnType<typeof parseListQuery>) => {
  if (result.success) {
    throw new Error('expected a validation error');
  }
  return {
    statusCode: result.error.statusCode,
    body: JSON.parse(result.error.body),
  };
};

describe('parseListQuery', () => {
  it('defaults to offset 0 and limit 1000 without date_from', () => {
    expect(parseListQuery(undefined)).toEqual({
      success: true,
      value: { offset: 0, limit: 1000, dateFrom: undefined },
    });
  });

  it('parses offset, limit and date_from', () => {
    expect(
      parseListQuery({
        offset: '200',
        limit: '100',
        date_from: '2026-08-20T15:30:00Z',
      }),
    ).toEqual({
      success: true,
      value: { offset: 200, limit: 100, dateFrom: '2026-08-20T15:30:00Z' },
    });
  });

  it('normalizes date_from to UTC seconds', () => {
    const result = parseListQuery({
      date_from: '2026-08-20T17:30:00.750+02:00',
    });

    expect(result.success && result.value.dateFrom).toBe(
      '2026-08-20T15:30:00Z',
    );
  });

  it('reads a date_from without zone as UTC', () => {
    const result = parseListQuery({ date_from: '2026-08-20T15:30:00' });

    expect(result.success && result.value.dateFrom).toBe(
      '2026-08-20T15:30:00Z',
    );
  });

  it('uses the given date_from format', () => {
    const result = parseListQuery(
      { date_from: '2026-08-20T15:30:00Z' },
      { formatDateFrom: (instant) => instant.toISOString() },
    );

    expect(result.success && result.value.dateFrom).toBe(
      '2026-08-20T15:30:00.000Z',
    );
  });

  it.each(['0', '1001', '-1', '1.5', 'abc', ''])(
    'rejects limit=%p with 400 / 2001',
    (limit) => {
      const error = errorOf(parseListQuery({ limit }));

      expect(error.statusCode).toBe(400);
      expect(error.body.status_code).toBe(2001);
      expect(error.body.status_message).toBe(
        `limit must be between 1 and ${MAX_LIMIT}`,
      );
    },
  );

  it.each(['-1', 'x', '1e3'])('rejects offset=%p', (offset) => {
    expect(errorOf(parseListQuery({ offset })).body.status_code).toBe(2001);
  });

  it.each(['yesterday', '2026-08-20', '2026-13-45T00:00:00Z'])(
    'rejects date_from=%p',
    (date_from) => {
      expect(errorOf(parseListQuery({ date_from })).statusCode).toBe(400);
    },
  );

  it('requires date_from when asked to', () => {
    expect(
      errorOf(parseListQuery({}, { requireDateFrom: true })).body
        .status_message,
    ).toBe('date_from is required');
  });

  it('rejects offset where it is not supported', () => {
    expect(
      errorOf(parseListQuery({ offset: '10' }, { allowOffset: false })).body
        .status_message,
    ).toBe('offset is not supported on this endpoint');
  });
});

describe('buildPaginationHeaders', () => {
  it('links the next page while objects remain', () => {
    const headers = buildPaginationHeaders(
      BASE_URL,
      '/locations',
      { offset: 100, limit: 100 },
      100,
      250,
    );

    expect(headers).toEqual({
      'X-Total-Count': '250',
      'X-Limit': '100',
      Link: `<${BASE_URL}/locations?offset=200&limit=100>; rel="next"`,
    });
  });

  it('continues after a page cut short by the size budget', () => {
    const headers = buildPaginationHeaders(
      BASE_URL,
      '/locations',
      { offset: 0, limit: 1000 },
      600,
      2000,
    );

    expect(headers.Link).toBe(
      `<${BASE_URL}/locations?offset=600&limit=1000>; rel="next"`,
    );
  });

  it('carries date_from into the next link', () => {
    const headers = buildPaginationHeaders(
      BASE_URL,
      '/tariffs',
      { offset: 0, limit: 10, dateFrom: '2026-08-20T15:30:00Z' },
      10,
      11,
    );

    expect(headers.Link).toBe(
      `<${BASE_URL}/tariffs?date_from=2026-08-20T15%3A30%3A00Z&offset=10&limit=10>; rel="next"`,
    );
  });

  it('has no link on the last page or past the end', () => {
    expect(
      buildPaginationHeaders(
        BASE_URL,
        '/locations',
        { offset: 200, limit: 100 },
        50,
        250,
      ).Link,
    ).toBeUndefined();
    expect(
      buildPaginationHeaders(
        BASE_URL,
        '/locations',
        { offset: 900, limit: 100 },
        0,
        250,
      ).Link,
    ).toBeUndefined();
  });
});
