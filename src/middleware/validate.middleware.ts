import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodSchema } from 'zod';
import { AppError } from '../shared/errors/app-error';
import { OcpiStatusCodes } from '../shared/errors/error-codes';

/**
 * Validates the request body against a Zod schema.
 */
export function validateBody(schema: ZodSchema) {
    return (req: Request, _res: Response, next: NextFunction) => {
        try {
            req.body = schema.parse(req.body);
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                return next(
                    new AppError(
                        'Invalid request payload',
                        400,
                        OcpiStatusCodes.INVALID_PAYLOAD,
                        {
                            issues: error.issues.map((issue) => ({
                                path: issue.path.join('.'),
                                message: issue.message,
                            })),
                        },
                    ),
                );
            }

            return next(
                new AppError(
                    'Unexpected validation error',
                    500,
                    OcpiStatusCodes.INTERNAL_SERVER_ERROR,
                ),
            );
        }
    };
}