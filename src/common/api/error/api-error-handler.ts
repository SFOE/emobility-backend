import { APIGatewayProxyResult } from 'aws-lambda';
import { HttpError } from '/opt/nodejs/api/error/http-error';

export class ErrorHandler {
    private static INTERNAL_SERVER_ERROR = 'Internal Server Error';

    public static handleError(err: unknown): APIGatewayProxyResult {
        if (err instanceof HttpError) {
            console.warn(`Returned Api Error.\ncode: ${err.statusCode}\nmessage: ${err.message}`);
            return prepareErrorResponse(err.message, err.statusCode);
        } else {
            console.error('Uncaught Error', err);
            return prepareErrorResponse(ErrorHandler.INTERNAL_SERVER_ERROR, 500);
        }
    }
}

const prepareErrorResponse = (message: string, statusCode: number): APIGatewayProxyResult => ({
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
});
