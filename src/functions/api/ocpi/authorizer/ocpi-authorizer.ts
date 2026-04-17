import { APIGatewayRequestAuthorizerEventV2 } from 'aws-lambda';
import { extractToken } from '/opt/nodejs/utils/api.utils';
import { getCredentials } from '/opt/nodejs/db/ocpi-credentials/ocpi-credentials.db';

export const handler = async (event: APIGatewayRequestAuthorizerEventV2) => {
  try {
    const authHeader =
      event.headers?.authorization || event.headers?.Authorization;

    const token = extractToken(authHeader);
    console.log('Auth attempt:', {
      hasToken: !!token,
      tokenHash: token?.slice(0, 8),
    });

    if (!token) {
      return { isAuthorized: false };
    }
    // Lookup credentials
    const item = await getCredentials(token);

    if (!item) {
      return { isAuthorized: false };
    }

    // Successfully authenticated
    return {
      isAuthorized: true,
      context: {
        credentials: item,
      },
    };
  } catch (err) {
    console.error('Authorizer error:', err);

    return {
      isAuthorized: false,
    };
  }
};
