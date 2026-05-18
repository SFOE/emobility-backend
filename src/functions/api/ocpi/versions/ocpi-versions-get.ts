import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getOCPIVersions } from '/opt/nodejs/modules/ocpi-version/ocpi-version.db';
import { ErrorHandler } from '/opt/nodejs/api/error/api-error-handler';
import { prepareOCPIResponse } from '/opt/nodejs/utils/api.utils';

/**
 * Handles GET /ocpi/versions.
 * Returns all OCPI versions supported by the emobility system,
 * including the URLs to their corresponding version detail endpoints.
 */
export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  console.log('GET versions:', JSON.stringify(event, null, 2));

  try {
    const versions = await getOCPIVersions();
    return prepareOCPIResponse(versions);
  } catch (error) {
    return ErrorHandler.handleError(error);
  }
};

