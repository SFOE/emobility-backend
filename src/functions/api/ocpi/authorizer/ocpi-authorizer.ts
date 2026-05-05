import { APIGatewayRequestAuthorizerEventV2 } from 'aws-lambda';
import { getCredentials } from '/opt/nodejs/db/ocpi-credentials/ocpi-credentials.db';
import { OCPIAuthorizerContext } from '/opt/nodejs/api/base.model';
import { extractToken, getPartnerId, getPrimaryRole } from '/opt/nodejs/utils/ocpi-utils';

export const handler = async (event: APIGatewayRequestAuthorizerEventV2) => {
  try {
    const authHeader =
      event.headers?.authorization || event.headers?.Authorization;

    const token = extractToken(authHeader);

    console.log('Auth attempt:', {
      hasToken: !!token,
      token: token?.slice(0, 8),
    });

    if (!token) {
      return { isAuthorized: false };
    }
    // Lookup credentials
    const item = await getCredentials(token);

    if (!item) {
      return { isAuthorized: false };
    }
    const context: OCPIAuthorizerContext = {
      isBootstrap: item.bootstrapToken ?? false,
      partnerId: getPartnerId(item),
      secretRef: item.secretRef,
      role: getPrimaryRole(item)?.role,
      country_code: getPrimaryRole(item)?.country_code,
      party_id: getPrimaryRole(item)?.party_id,
      credentialPk: item.pk
    };

    // Successfully authenticated
    return {
      isAuthorized: true,
      context,
    };
  } catch (err) {
    console.error('Authorizer error:', err);

    return {
      isAuthorized: false,
    };
  }
};
