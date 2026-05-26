import { APIGatewayProxyEventV2WithLambdaAuthorizer } from 'aws-lambda/trigger/api-gateway-proxy';
import { OCPIAuthorizerContext } from '/opt/nodejs/api/base.model';
import {
    CONNECTOR_ID,
    EVSE_UID,
    LOCATION_ID,
    VALID_CONNECTOR,
    VALID_EVSE,
    VALID_LOCATION,
    VALID_PATCH,
} from '../test-data/ocpi-locations.data';

// Auth context set by the Lambda authorizer for a registered (non-bootstrap) CPO.
const { country_code, party_id } = VALID_LOCATION;
export const CPO_AUTH_CONTEXT: OCPIAuthorizerContext = {
    isBootstrap: false,
    partnerId: `CPO-${party_id}-${country_code}`,
    role: 'CPO',
    country_code,
    party_id,
};

// Shared base for all location event builders.
function buildRawEvent(
    method: 'PUT' | 'PATCH',
    rawPath: string,
    pathParameters: Record<string, string>,
    body: string | undefined,
    authContext: OCPIAuthorizerContext,
): APIGatewayProxyEventV2WithLambdaAuthorizer<OCPIAuthorizerContext> {
    return {
        version: '2.0',
        routeKey: `${method} ${rawPath}`,
        rawPath,
        rawQueryString: '',
        headers: {},
        requestContext: {
            authorizer: { lambda: authContext },
            accountId: '000000000000',
            apiId: 'test',
            domainName: 'localhost',
            domainPrefix: 'test',
            http: { method, path: rawPath, protocol: 'HTTP/1.1', sourceIp: '127.0.0.1', userAgent: 'jest' },
            requestId: 'test-request-id',
            routeKey: `${method} ${rawPath}`,
            stage: '$default',
            time: '01/Jan/2025:00:00:00 +0000',
            timeEpoch: 1735689600000,
        },
        pathParameters,
        body,
        isBase64Encoded: false,
    } as unknown as APIGatewayProxyEventV2WithLambdaAuthorizer<OCPIAuthorizerContext>;
}

// ─── Location ──────────────────────────────────────────────────────────────────

export function buildLocationPutEvent(overrides: {
    authContext?: Partial<OCPIAuthorizerContext>;
    body?: string | null;
    version?: string;
    country_code?: string;
    party_id?: string;
    location_id?: string;
} = {}): APIGatewayProxyEventV2WithLambdaAuthorizer<OCPIAuthorizerContext> {
    const {
        authContext = CPO_AUTH_CONTEXT,
        body = JSON.stringify(VALID_LOCATION),
        version = '2.2.1',
        country_code: cc = VALID_LOCATION.country_code,
        party_id: pid = VALID_LOCATION.party_id,
        location_id: lid = LOCATION_ID,
    } = overrides;

    const rawPath = `/ocpi/${version}/locations/${cc}/${pid}/${lid}`;
    return buildRawEvent('PUT', rawPath, { version, country_code: cc, party_id: pid, location_id: lid }, body ?? undefined, authContext as OCPIAuthorizerContext);
}

export function buildLocationPatchEvent(overrides: {
    authContext?: Partial<OCPIAuthorizerContext>;
    body?: string | null;
    version?: string;
    country_code?: string;
    party_id?: string;
    location_id?: string;
} = {}): APIGatewayProxyEventV2WithLambdaAuthorizer<OCPIAuthorizerContext> {
    const {
        authContext = CPO_AUTH_CONTEXT,
        body = JSON.stringify(VALID_PATCH),
        version = '2.2.1',
        country_code: cc = VALID_LOCATION.country_code,
        party_id: pid = VALID_LOCATION.party_id,
        location_id: lid = LOCATION_ID,
    } = overrides;

    const rawPath = `/ocpi/${version}/locations/${cc}/${pid}/${lid}`;
    return buildRawEvent('PATCH', rawPath, { version, country_code: cc, party_id: pid, location_id: lid }, body ?? undefined, authContext as OCPIAuthorizerContext);
}

// ─── EVSE ──────────────────────────────────────────────────────────────────────

export function buildEvsePutEvent(overrides: {
    authContext?: Partial<OCPIAuthorizerContext>;
    body?: string | null;
    version?: string;
    country_code?: string;
    party_id?: string;
    location_id?: string;
    evse_uid?: string;
} = {}): APIGatewayProxyEventV2WithLambdaAuthorizer<OCPIAuthorizerContext> {
    const {
        authContext = CPO_AUTH_CONTEXT,
        body = JSON.stringify(VALID_EVSE),
        version = '2.2.1',
        country_code: cc = VALID_LOCATION.country_code,
        party_id: pid = VALID_LOCATION.party_id,
        location_id: lid = LOCATION_ID,
        evse_uid: uid = EVSE_UID,
    } = overrides;

    const rawPath = `/ocpi/${version}/locations/${cc}/${pid}/${lid}/${uid}`;
    return buildRawEvent('PUT', rawPath, { version, country_code: cc, party_id: pid, location_id: lid, evse_uid: uid }, body ?? undefined, authContext as OCPIAuthorizerContext);
}

export function buildEvsePatchEvent(overrides: {
    authContext?: Partial<OCPIAuthorizerContext>;
    body?: string | null;
    version?: string;
    country_code?: string;
    party_id?: string;
    location_id?: string;
    evse_uid?: string;
} = {}): APIGatewayProxyEventV2WithLambdaAuthorizer<OCPIAuthorizerContext> {
    const {
        authContext = CPO_AUTH_CONTEXT,
        body = JSON.stringify(VALID_PATCH),
        version = '2.2.1',
        country_code: cc = VALID_LOCATION.country_code,
        party_id: pid = VALID_LOCATION.party_id,
        location_id: lid = LOCATION_ID,
        evse_uid: uid = EVSE_UID,
    } = overrides;

    const rawPath = `/ocpi/${version}/locations/${cc}/${pid}/${lid}/${uid}`;
    return buildRawEvent('PATCH', rawPath, { version, country_code: cc, party_id: pid, location_id: lid, evse_uid: uid }, body ?? undefined, authContext as OCPIAuthorizerContext);
}

// ─── Connector ─────────────────────────────────────────────────────────────────

export function buildConnectorPutEvent(overrides: {
    authContext?: Partial<OCPIAuthorizerContext>;
    body?: string | null;
    version?: string;
    country_code?: string;
    party_id?: string;
    location_id?: string;
    evse_uid?: string;
    connector_id?: string;
} = {}): APIGatewayProxyEventV2WithLambdaAuthorizer<OCPIAuthorizerContext> {
    const {
        authContext = CPO_AUTH_CONTEXT,
        body = JSON.stringify(VALID_CONNECTOR),
        version = '2.2.1',
        country_code: cc = VALID_LOCATION.country_code,
        party_id: pid = VALID_LOCATION.party_id,
        location_id: lid = LOCATION_ID,
        evse_uid: uid = EVSE_UID,
        connector_id: cid = CONNECTOR_ID,
    } = overrides;

    const rawPath = `/ocpi/${version}/locations/${cc}/${pid}/${lid}/${uid}/${cid}`;
    return buildRawEvent('PUT', rawPath, { version, country_code: cc, party_id: pid, location_id: lid, evse_uid: uid, connector_id: cid }, body ?? undefined, authContext as OCPIAuthorizerContext);
}

export function buildConnectorPatchEvent(overrides: {
    authContext?: Partial<OCPIAuthorizerContext>;
    body?: string | null;
    version?: string;
    country_code?: string;
    party_id?: string;
    location_id?: string;
    evse_uid?: string;
    connector_id?: string;
} = {}): APIGatewayProxyEventV2WithLambdaAuthorizer<OCPIAuthorizerContext> {
    const {
        authContext = CPO_AUTH_CONTEXT,
        body = JSON.stringify(VALID_PATCH),
        version = '2.2.1',
        country_code: cc = VALID_LOCATION.country_code,
        party_id: pid = VALID_LOCATION.party_id,
        location_id: lid = LOCATION_ID,
        evse_uid: uid = EVSE_UID,
        connector_id: cid = CONNECTOR_ID,
    } = overrides;

    const rawPath = `/ocpi/${version}/locations/${cc}/${pid}/${lid}/${uid}/${cid}`;
    return buildRawEvent('PATCH', rawPath, { version, country_code: cc, party_id: pid, location_id: lid, evse_uid: uid, connector_id: cid }, body ?? undefined, authContext as OCPIAuthorizerContext);
}
