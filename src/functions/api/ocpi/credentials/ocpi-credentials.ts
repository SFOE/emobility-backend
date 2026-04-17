import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ErrorHandler } from '/opt/nodejs/api/error/api-error-handler';
import { prepareOCPIResponse } from '/opt/nodejs/utils/api.utils';
import { OCPICredential } from '/opt/nodejs/db/ocpi-credentials/ocpi-credentials.model';
import { saveCredentials } from '/opt/nodejs/db/ocpi-credentials/ocpi-credentials.db';
import { generateToken } from '/opt/nodejs/utils/crypto.utils';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const cpoCredentials: OCPICredential = JSON.parse(event.body ?? '{}');

    // Basic validation
    if (!cpoCredentials.token) {
      return ErrorHandler.handleBadRequestError(2001, 'Invalid credentials payload');
    }

    // Partner aus Authorizer
    // const authContext = event.requestContext?.authorizer?.lambda || {};

    const newToken = generateToken();

    // save credentials
    await saveCredentials(cpoCredentials, newToken);

    const response: OCPICredential = {
      token: newToken,
      url: `${process.env.BASE_URL}/ocpi/versions`,
      roles: [
        {
          role: 'NAP',
          business_details: {
            name: 'Bundesamt für Energie',
          },
          party_id: 'BFE',
          country_code: 'CH',
        },
      ],
    };

    return prepareOCPIResponse(response);
  } catch (err) {
    console.error(err);
    return ErrorHandler.handleError(err);
  }
};
