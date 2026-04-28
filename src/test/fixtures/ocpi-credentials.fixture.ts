import { APIGatewayProxyEventV2WithLambdaAuthorizer } from 'aws-lambda/trigger/api-gateway-proxy';
import { OCPIAuthorizerContext } from '../../common/api/base.model';
import { VALID_CREDENTIAL, BOOTSTRAP_TOKEN } from '../test-data/ocpi-credentials.data';

// Auth context set by the Lambda authorizer for bootstrap tokens.
const { role, party_id, country_code } = VALID_CREDENTIAL.roles[0];
export const BOOTSTRAP_AUTH_CONTEXT: OCPIAuthorizerContext = {
  isBootstrap: true,
  partnerId: `${role}-${party_id}-${country_code}`,
};

// Builds a full API Gateway event with sensible defaults; individual fields can be overridden.
export function buildEvent(overrides: {
  authContext?: Partial<OCPIAuthorizerContext>;
  body?: string | null;
  version?: string;
  authorizationHeader?: string;
} = {}): APIGatewayProxyEventV2WithLambdaAuthorizer<OCPIAuthorizerContext> {
  const {
    authContext = BOOTSTRAP_AUTH_CONTEXT,
    body = JSON.stringify(VALID_CREDENTIAL),
    version = '2.2.1',
    authorizationHeader = `Token ${BOOTSTRAP_TOKEN}`,
  } = overrides;

  return {
    version: '2.0',
    routeKey: `POST /ocpi/{version}/credentials`,
    rawPath: `/ocpi/${version}/credentials`,
    rawQueryString: '',
    headers: { authorization: authorizationHeader },
    requestContext: {
      authorizer: { lambda: authContext as OCPIAuthorizerContext },
      accountId: '000000000000',
      apiId: 'test',
      domainName: 'localhost',
      domainPrefix: 'test',
      http: { method: 'POST', path: `/ocpi/${version}/credentials`, protocol: 'HTTP/1.1', sourceIp: '127.0.0.1', userAgent: 'jest' },
      requestId: 'test-request-id',
      routeKey: `POST /ocpi/{version}/credentials`,
      stage: '$default',
      time: '01/Jan/2025:00:00:00 +0000',
      timeEpoch: 1735689600000,
    },
    pathParameters: { version },
    body: body ?? undefined,
    isBase64Encoded: false,
  } as unknown as APIGatewayProxyEventV2WithLambdaAuthorizer<OCPIAuthorizerContext>;
}
