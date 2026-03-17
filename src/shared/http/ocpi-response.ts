/**
 * Minimal OCPI-like response builder for consistent API responses.
 */
export function buildOcpiResponse<T>(
    data: T,
    statusCode = 1000,
    statusMessage = 'Success',
) {
    return {
        status_code: statusCode,
        status_message: statusMessage,
        timestamp: new Date().toISOString(),
        data,
    };
}

/**
 * Minimal OCPI-like error response builder.
 */
export function buildOcpiErrorResponse(
    statusCode: number,
    statusMessage: string,
    details?: unknown,
) {
    return {
        status_code: statusCode,
        status_message: statusMessage,
        timestamp: new Date().toISOString(),
        ...(details ? { data: details } : {}),
    };
}