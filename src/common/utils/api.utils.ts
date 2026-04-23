import { APIGatewayProxyResult } from 'aws-lambda';
import {
  OCPIAuthorizerContext,
  OCPIResponse,
} from '/opt/nodejs/api/base.model';
import { APIGatewayProxyEventV2WithLambdaAuthorizer } from 'aws-lambda/trigger/api-gateway-proxy';
import { SUPPORTED_VERSIONS } from '/opt/nodejs/config.constants';
import { ErrorHandler } from '/opt/nodejs/api/error/api-error-handler';

const OCPI_HEADERS = {
  'Content-Type': 'application/json',
};

export const prepareOCPIResponse = (data: unknown): APIGatewayProxyResult => ({
  statusCode: 200,
  headers: OCPI_HEADERS,
  body: JSON.stringify(ocpiSuccess(data)),
});

const ocpiSuccess = <T>(
  data: T,
  statusMessage = 'Success',
): OCPIResponse<T> => {
  return {
    data,
    status_code: 1000,
    status_message: statusMessage,
    timestamp: new Date().toISOString(),
  };
};

type OCPIHandler = (
  event: APIGatewayProxyEventV2WithLambdaAuthorizer<OCPIAuthorizerContext>,
  authContext: OCPIAuthorizerContext,
  ocpiVersion: string,
) => Promise<APIGatewayProxyResult>;

export const withVersionCheck =
  (handler: OCPIHandler) =>
  async (
    event: APIGatewayProxyEventV2WithLambdaAuthorizer<OCPIAuthorizerContext>,
  ): Promise<APIGatewayProxyResult> => {
    // get Authorizer Context
    const authContext = event.requestContext?.authorizer?.lambda || {};
    const version = event.pathParameters?.version ?? 'unknown';

    if (!SUPPORTED_VERSIONS.includes(version)) {
      return ErrorHandler.handleUnsupportedVersionError(version);
    }

    return handler(event, authContext, version);
  };
