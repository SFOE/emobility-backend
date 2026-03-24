import { NextFunction, Request, Response } from 'express';
import { AppError } from '../shared/errors/app-error';
import { OcpiStatusCodes } from '../shared/errors/error-codes';

/**
 * Handles unknown routes.
 */
export function notFoundMiddleware(
    _req: Request,
    _res: Response,
    next: NextFunction,
) {
    next(
        new AppError(
            'Route not found',
            404,
            OcpiStatusCodes.ROUTE_NOT_FOUND,
        ),
    );
}