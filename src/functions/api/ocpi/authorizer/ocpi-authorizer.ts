import { APIGatewayRequestAuthorizerEventV2 } from 'aws-lambda';
import { getCredentials } from '/opt/nodejs/db/ocpi-credentials/ocpi-credentials.db';
import { OCPIAuthorizerContext } from '/opt/nodejs/api/base.model';
import { extractToken, getPartnerId } from '/opt/nodejs/utils/ocpi-utils';

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
