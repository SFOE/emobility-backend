import { APIGatewayProxyResult } from 'aws-lambda';
import { ErrorHandler } from '/opt/nodejs/api/error/api-error-handler';

// OCPI default and the maximum the consumer documentation allows.
export const DEFAULT_LIMIT = 1000;
export const MAX_LIMIT = 1000;

// Lambda caps a response at 6 MB. A page stops adding objects once their bodies
// reach this budget and returns fewer than `limit` - which OCPI allows, the
// `Link` header then points at the next offset.
export const MAX_PAGE_BODY_BYTES = 5_000_000;

export interface ListQuery {
  offset: number;
  limit: number;
  // Normalized ISO-8601 UTC, see normalizeDateFrom.
  dateFrom?: string;
}

type ParseResult<T> =
  | { success: true; value: T }
  | { success: false; error: APIGatewayProxyResult };

const invalid = <T>(message: string): ParseResult<T> => ({
  success: false,
  error: ErrorHandler.handleBadRequestError(2001, message),
});

const parseInteger = (value: string): number | null =>
  /^\d+$/.test(value) ? Number(value) : null;

/**
 * Parses an OCPI DateTime query value into an instant.
 *
 * Requires an explicit date and time (`YYYY-MM-DDTHH:MM`…); a value without a
 * zone designator is read as UTC, as OCPI timestamps are UTC.
 */
const parseDateTime = (value: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
    return null;
  }
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(value);
  const instant = new Date(hasZone ? value : `${value}Z`);
  return isNaN(instant.getTime()) ? null : instant;
};

/**
 * `date_from` as `YYYY-MM-DDTHH:MM:SSZ`, the format of the serving tables'
 * `last_updated`, so it can be compared as a string against their GSI2 key.
 * Fractions of a second are cut off, which can only widen the result.
 */
export const toSecondsTimestamp = (instant: Date): string =>
  `${instant.toISOString().slice(0, 19)}Z`;

/**
 * Parses `offset`, `limit` and (optionally) `date_from` of a list request.
 * With `requireDateFrom`, `date_from` is mandatory (`/status`); with
 * `allowOffset = false`, `offset` is rejected (unpaginated `/status`).
 */
export const parseListQuery = (
  query: Record<string, string | undefined> | undefined | null,
  options: {
    requireDateFrom?: boolean;
    allowOffset?: boolean;
    formatDateFrom?: (instant: Date) => string;
  } = {},
): ParseResult<ListQuery> => {
  const {
    requireDateFrom = false,
    allowOffset = true,
    formatDateFrom = toSecondsTimestamp,
  } = options;
  const params = query ?? {};

  let offset = 0;
  if (params.offset !== undefined) {
    if (!allowOffset) {
      return invalid('offset is not supported on this endpoint');
    }
    const parsed = parseInteger(params.offset);
    if (parsed === null) {
      return invalid('offset must be a non-negative integer');
    }
    offset = parsed;
  }

  let limit = DEFAULT_LIMIT;
  if (params.limit !== undefined) {
    const parsed = parseInteger(params.limit);
    if (parsed === null || parsed < 1 || parsed > MAX_LIMIT) {
      return invalid(`limit must be between 1 and ${MAX_LIMIT}`);
    }
    limit = parsed;
  }

  let dateFrom: string | undefined;
  if (params.date_from !== undefined) {
    const instant = parseDateTime(params.date_from);
    if (instant === null) {
      return invalid(
        'date_from must be an ISO 8601 date-time, e.g. 2026-08-20T15:30:00Z',
      );
    }
    dateFrom = formatDateFrom(instant);
  } else if (requireDateFrom) {
    return invalid('date_from is required');
  }

  return { success: true, value: { offset, limit, dateFrom } };
};

/**
 * OCPI pagination headers: `X-Total-Count`, `X-Limit` and, if there is a next
 * page, `Link: <…?offset=…&limit=…>; rel="next"` (carrying `date_from` along).
 */
export const buildPaginationHeaders = (
  baseUrl: string,
  path: string,
  query: ListQuery,
  returned: number,
  total: number,
): Record<string, string> => {
  const headers: Record<string, string> = {
    'X-Total-Count': String(total),
    'X-Limit': String(query.limit),
  };

  const nextOffset = query.offset + returned;
  if (returned > 0 && nextOffset < total) {
    const next = new URLSearchParams();
    if (query.dateFrom !== undefined) {
      next.set('date_from', query.dateFrom);
    }
    next.set('offset', String(nextOffset));
    next.set('limit', String(query.limit));
    headers.Link = `<${baseUrl}${path}?${next.toString()}>; rel="next"`;
  }

  return headers;
};
