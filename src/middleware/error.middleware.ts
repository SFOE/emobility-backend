import { NextFunction, Request, Response } from 'express';
import { logger } from '../config/logger';
import { AppError } from '../shared/errors/app-error';
import { OcpiStatusCodes } from '../shared/errors/error-codes';
import { buildOcpiErrorResponse } from '../shared/http/ocpi-response';

/**
 * Handles unexpected application errors.
 */
export function errorMiddleware(
    error: unknown,
    req: Request,
    res: Response,
    _next: NextFunction,
) {
    if (error instanceof AppError) {
        logger.warn(
            {
                requestId: req.requestId,
                partnerId: req.partner?.id,
                httpStatus: error.httpStatus,
                ocpiStatusCode: error.ocpiStatusCode,
                details: error.details,
            },
            error.message,
        );

        return res.status(error.httpStatus).json(
            buildOcpiErrorResponse(
                error.ocpiStatusCode,
                error.message,
                error.details,
            ),
        );
    }

    logger.error(
        {
            requestId: req.requestId,
            partnerId: req.partner?.id,
            error,
        },
        'Unhandled application error',
    );

    return res.status(500).json(
        buildOcpiErrorResponse(
            OcpiStatusCodes.INTERNAL_SERVER_ERROR,
            'Internal server error',
        ),
    );
}