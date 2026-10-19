import { APIGatewayProxyEventV2 } from 'aws-lambda';

// Builds an API Gateway (HTTP API, payload v2) event for a public GET route - no authorizer.
export function buildPublicGetEvent(
  routeKey: string,
  rawPath: string,
  pathParameters: Record<string, string> = {},
  queryStringParameters?: Record<string, string>,
): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey,
    rawPath,
    rawQueryString: new URLSearchParams(queryStringParameters).toString(),
    headers: {},
    requestContext: {
      accountId: '000000000000',
      apiId: 'test',
      domainName: 'localhost',
      domainPrefix: 'test',
      http: {
        method: 'GET',
        path: rawPath,
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'jest',
      },
      requestId: 'test-request-id',
      routeKey,
      stage: '$default',
      time: '01/Jan/2025:00:00:00 +0000',
      timeEpoch: 1735689600000,
    },
    pathParameters,
    queryStringParameters,
    isBase64Encoded: false,
  };
}

export const buildLocationGetEvent = (
  country_code = 'CH',
  party_id = 'ABC',
  location_id = 'LOC-001',
) =>
  buildPublicGetEvent(
    'GET /locations/{country_code}/{party_id}/{location_id}',
    `/locations/${country_code}/${party_id}/${location_id}`,
    { country_code, party_id, location_id },
  );

export const buildLocationsListEvent = (query?: Record<string, string>) =>
  buildPublicGetEvent('GET /locations', '/locations', {}, query);

export const buildTariffsListEvent = (query?: Record<string, string>) =>
  buildPublicGetEvent('GET /tariffs', '/tariffs', {}, query);

export const buildTariffGetEvent = (
  country_code = 'CH',
  party_id = 'ABC',
  tariff_id = 'TARIFF-DC-01',
) =>
  buildPublicGetEvent(
    'GET /tariffs/{country_code}/{party_id}/{tariff_id}',
    `/tariffs/${country_code}/${party_id}/${tariff_id}`,
    { country_code, party_id, tariff_id },
  );

export const buildStatusGetEvent = (
  country_code = 'CH',
  party_id = 'GFS',
  location_id = '78594',
  evse_uid = '251674',
) =>
  buildPublicGetEvent(
    'GET /status/{country_code}/{party_id}/{location_id}/evses/{evse_uid}',
    `/status/${country_code}/${party_id}/${location_id}/evses/${evse_uid}`,
    { country_code, party_id, location_id, evse_uid },
  );

export const buildStatusListEvent = (query?: Record<string, string>) =>
  buildPublicGetEvent('GET /status', '/status', {}, query);
