import { APIGatewayProxyResult } from 'aws-lambda';
import { OCPIAuthorizerContext } from '/opt/nodejs/api/base.model';
import { ErrorHandler } from '/opt/nodejs/api/error/api-error-handler';

// Rejects bootstrap tokens for endpoints that require a fully registered party.
export function assertNotBootstrap(
  authContext: OCPIAuthorizerContext,
  label: string,
): APIGatewayProxyResult | null {
  if (!authContext.isBootstrap) {
    return null;
  }

  console.warn(
    `[OCPI][${label}] Rejected — bootstrap token used by ${authContext.partnerId}`,
  );
  return ErrorHandler.handleBadRequestError(
    2000,
    'Bootstrap tokens are not allowed for this operation.',
    405,
  );
}

// Enforces that the authenticated party has the required OCPI role.
export function assertRole(
  authContext: OCPIAuthorizerContext,
  requiredRole: string,
  label: string,
): APIGatewayProxyResult | null {
  if (authContext.role === requiredRole) {
    return null;
  }

  console.warn(
    `[OCPI][${label}] Rejected — role '${authContext.role}' is not allowed, expected '${requiredRole}' (party: ${authContext.partnerId})`,
  );
  return ErrorHandler.handleBadRequestError(
    2000,
    `Only ${requiredRole}s are allowed to perform this operation.`,
    405,
  );
}

// Enforces Client Owned Objects: authenticated party must own the namespace in the path.
export function assertOwnership(
  authContext: OCPIAuthorizerContext,
  pathCountryCode: string | undefined,
  pathPartyId: string | undefined,
  label: string,
): APIGatewayProxyResult | null {
  if (
    authContext.country_code === pathCountryCode &&
    authContext.party_id === pathPartyId
  ) {
    return null;
  }

  console.warn(
    `[OCPI][${label}] Rejected — ownership mismatch for ${authContext.partnerId}: auth=${authContext.country_code}/${authContext.party_id}, path=${pathCountryCode}/${pathPartyId}`,
  );
  return ErrorHandler.handleBadRequestError(
    2001,
    'Authenticated party does not own this namespace.',
  );
}

// Enforces that path identifiers match the body identifiers (country_code, party_id, id).
export function assertBodyConsistency(
  body: { country_code: string; party_id: string; id: string },
  pathCountryCode: string | undefined,
  pathPartyId: string | undefined,
  pathId: string | undefined,
  label: string,
  partnerId: string,
): APIGatewayProxyResult | null {
  if (
    body.country_code === pathCountryCode &&
    body.party_id === pathPartyId &&
    body.id === pathId
  ) {
    return null;
  }

  const partyRef = `${pathCountryCode}/${pathPartyId}/${pathId}`;
  console.warn(
    `[OCPI][${label}] Rejected — body mismatch for ${partnerId}: path=${partyRef}, body=${body.country_code}/${body.party_id}/${body.id}`,
  );
  return ErrorHandler.handleBadRequestError(
    2001,
    'Identifiers in path and body do not match.',
  );
}
