import { APIGatewayProxyResult } from 'aws-lambda';
import { HttpError } from '/opt/nodejs/api/error/http-error';
import { OCPIResponse } from '/opt/nodejs/api/base.model';

export class ErrorHandler {
  private static INTERNAL_SERVER_ERROR = 'Internal Server Error';

  public static handleError(err: unknown): APIGatewayProxyResult {
    if (err instanceof HttpError) {
      console.warn(
        `Returned Api Error.\ncode: ${err.statusCode}\nmessage: ${err.message}`,
      );
      return prepareOCPIErrorResponse(err.message, err.statusCode);
    } else {
      console.error('Uncaught Error', err);
      return prepareOCPIErrorResponse(ErrorHandler.INTERNAL_SERVER_ERROR, 500);
    }
  }

  public static handleBadRequestError(
    ocpiStatusCode: number,
    message: string,
    statusCode = 400,
  ): APIGatewayProxyResult {
    return prepareOCPIErrorResponse(message, statusCode, ocpiStatusCode);
  }

  public static handleUnsupportedVersionError(
    version: string,
  ): APIGatewayProxyResult {
    return prepareOCPIErrorResponse(
      `Unsupported version: ${version}`,
      400,
      3002,
    );
  }
}

const prepareOCPIErrorResponse = (
  message: string,
  statusCode: number,
  ocpiStatusCode = 3000,
): APIGatewayProxyResult => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(ocpiError(ocpiStatusCode, message)),
});

const ocpiError = <T>(
  statusCode = 3000,
  statusMessage = 'Unknown Error',
): OCPIResponse<T> => {
  return {
    status_code: statusCode,
    status_message: statusMessage,
    timestamp: new Date().toISOString(),
  };
};
