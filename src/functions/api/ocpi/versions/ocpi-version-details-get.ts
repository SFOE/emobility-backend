import {APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda";
import {ErrorHandler} from "/opt/nodejs/api/error/api-error-handler";
import {prepareOCPIResponse} from "/opt/nodejs/utils/api.utils";
import {getOCPIVersionDetails} from "/opt/nodejs/modules/ocpi-version/ocpi-version.db";

/**
 * Handles GET /ocpi/{version}.
 * Returns the available OCPI module endpoints for the requested version,
 * allowing external partners to discover supported API resources.
 */
export const handler = async (
    event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
    const version = event.pathParameters?.version;
    console.log('Get version detail of:', version);

    try {
        if (!version) {
            return ErrorHandler.handleError('Version is required.');
        }
        const versionDetail = await getOCPIVersionDetails(version);
        if (!versionDetail) {
            return ErrorHandler.handleUnsupportedVersionError(version);
        }
        return prepareOCPIResponse(versionDetail);
    } catch (error) {
        return ErrorHandler.handleError(error);
    }
};