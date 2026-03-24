
/**
 * Application error with HTTP and OCPI-like status metadata.
 */
export class AppError extends Error {
    public readonly httpStatus: number;
    public readonly ocpiStatusCode: number;
    public readonly details?: unknown;

    constructor(
        message: string,
        httpStatus: number,
        ocpiStatusCode: number,
        details?: unknown,
    ) {
        super(message);
        this.name = 'AppError';
        this.httpStatus = httpStatus;
        this.ocpiStatusCode = ocpiStatusCode;
        this.details = details;
    }
}