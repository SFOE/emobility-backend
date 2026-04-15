import {APIGatewayProxyEvent, APIGatewayProxyResult} from 'aws-lambda';
import {getOCPIVersionDetails, getOCPIVersions} from '/opt/nodejs/db/ocpi-version/ocpi-version.db';
import {ErrorHandler} from '/opt/nodejs/api/error/api-error-handler';
import {prepareOCPIResponse} from '/opt/nodejs/utils/api.utils';

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

export const detail = async (
    event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
    const version = event.pathParameters?.version;
    console.log('Get version detail of:', version);

    try {
        if (!version) {
            return ErrorHandler.handleError("Version is required.")
        }
        const versionDetail = await getOCPIVersionDetails(version);
        return prepareOCPIResponse(versionDetail);
    } catch (error) {
        return ErrorHandler.handleError(error);
    }
};
