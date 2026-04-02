import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { getAllOcpiVersions } from '/opt/nodejs/db/ocpi-version/ocpi-version.db';
import { ErrorHandler } from '/opt/nodejs/api/error/api-error-handler';
import { prepareResponse } from '/opt/nodejs/utils/api.utils';

export const handler = async (
    event: APIGatewayProxyEvent,
    context: Context
): Promise<APIGatewayProxyResult> => {
    console.log('Event:', JSON.stringify(event, null, 2));
    console.log('Context:', JSON.stringify(context, null, 2));

    try {
        const versions = await getAllOcpiVersions();
        console.info(`Retrieving ${versions.length} OCPI versions`);
        return prepareResponse(versions);
    } catch (error) {
        return ErrorHandler.handleError(error);
    }
};
