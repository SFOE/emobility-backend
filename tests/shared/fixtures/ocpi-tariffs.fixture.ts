import { APIGatewayProxyEventV2WithLambdaAuthorizer } from 'aws-lambda/trigger/api-gateway-proxy';
import { OCPIAuthorizerContext } from '/opt/nodejs/api/base.model';
import { VALID_TARIFF, TARIFF_ID } from '../test-data/ocpi-tariffs.data';

// Auth context set by the Lambda authorizer for a registered (non-bootstrap) CPO.
const { country_code, party_id } = VALID_TARIFF;
export const CPO_AUTH_CONTEXT: OCPIAuthorizerContext = {
  isBootstrap: false,
  partnerId: `CPO-${party_id}-${country_code}`,
  role: 'CPO',
  country_code,
  party_id,
};

// Builds a full API Gateway event for PUT /tariffs with sensible defaults; individual fields can be overridden.
export function buildEvent(overrides: {
  authContext?: Partial<OCPIAuthorizerContext>;
  body?: string | null;
  version?: string;
  country_code?: string;
  party_id?: string;
  tariff_id?: string;
} = {}): APIGatewayProxyEventV2WithLambdaAuthorizer<OCPIAuthorizerContext> {
  const {
    authContext = CPO_AUTH_CONTEXT,
    body = JSON.stringify(VALID_TARIFF),
    version = '2.2.1',
    country_code: pathCountryCode = VALID_TARIFF.country_code,
    party_id: pathPartyId = VALID_TARIFF.party_id,
    tariff_id: pathTariffId = TARIFF_ID,
  } = overrides;

  return {
    version: '2.0',
    routeKey: `PUT /ocpi/{version}/tariffs/{country_code}/{party_id}/{tariff_id}`,
    rawPath: `/ocpi/${version}/tariffs/${pathCountryCode}/${pathPartyId}/${pathTariffId}`,
    rawQueryString: '',
    headers: {},
    requestContext: {
      authorizer: { lambda: authContext as OCPIAuthorizerContext },
      accountId: '000000000000',
      apiId: 'test',
      domainName: 'localhost',
      domainPrefix: 'test',
      http: { method: 'PUT', path: `/ocpi/${version}/tariffs/${pathCountryCode}/${pathPartyId}/${pathTariffId}`, protocol: 'HTTP/1.1', sourceIp: '127.0.0.1', userAgent: 'jest' },
      requestId: 'test-request-id',
      routeKey: `PUT /ocpi/{version}/tariffs/{country_code}/{party_id}/{tariff_id}`,
      stage: '$default',
      time: '01/Jan/2025:00:00:00 +0000',
      timeEpoch: 1735689600000,
    },
    pathParameters: { version, country_code: pathCountryCode, party_id: pathPartyId, tariff_id: pathTariffId },
    body: body ?? undefined,
    isBase64Encoded: false,
  } as unknown as APIGatewayProxyEventV2WithLambdaAuthorizer<OCPIAuthorizerContext>;
}

// Builds a full API Gateway event for DELETE /tariffs with sensible defaults; individual fields can be overridden.
export function buildDeleteEvent(overrides: {
  authContext?: Partial<OCPIAuthorizerContext>;
  version?: string;
  country_code?: string;
  party_id?: string;
  tariff_id?: string;
} = {}): APIGatewayProxyEventV2WithLambdaAuthorizer<OCPIAuthorizerContext> {
  const {
    authContext = CPO_AUTH_CONTEXT,
    version = '2.2.1',
    country_code: pathCountryCode = VALID_TARIFF.country_code,
    party_id: pathPartyId = VALID_TARIFF.party_id,
    tariff_id: pathTariffId = TARIFF_ID,
  } = overrides;

  return {
    version: '2.0',
    routeKey: `DELETE /ocpi/{version}/tariffs/{country_code}/{party_id}/{tariff_id}`,
    rawPath: `/ocpi/${version}/tariffs/${pathCountryCode}/${pathPartyId}/${pathTariffId}`,
    rawQueryString: '',
    headers: {},
    requestContext: {
      authorizer: { lambda: authContext as OCPIAuthorizerContext },
      accountId: '000000000000',
      apiId: 'test',
      domainName: 'localhost',
      domainPrefix: 'test',
      http: { method: 'DELETE', path: `/ocpi/${version}/tariffs/${pathCountryCode}/${pathPartyId}/${pathTariffId}`, protocol: 'HTTP/1.1', sourceIp: '127.0.0.1', userAgent: 'jest' },
      requestId: 'test-request-id',
      routeKey: `DELETE /ocpi/{version}/tariffs/{country_code}/{party_id}/{tariff_id}`,
      stage: '$default',
      time: '01/Jan/2025:00:00:00 +0000',
      timeEpoch: 1735689600000,
    },
    pathParameters: { version, country_code: pathCountryCode, party_id: pathPartyId, tariff_id: pathTariffId },
    isBase64Encoded: false,
  } as unknown as APIGatewayProxyEventV2WithLambdaAuthorizer<OCPIAuthorizerContext>;
}
