import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodSchema } from 'zod';
import { buildOcpiErrorResponse } from '../shared/http/ocpi-response';


/**
 * Validates the request body against a Zod schema.
 */
export function validateBody(schema: ZodSchema) {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            req.body = schema.parse(req.body);
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                return res.status(400).json(
                    buildOcpiErrorResponse(2001, 'Invalid request payload', {
                        issues: error.issues.map((issue) => ({
                            path: issue.path.join('.'),
                            message: issue.message,
                        })),
                    }),
                );
            }

            return res.status(500).json(
                buildOcpiErrorResponse(3000, 'Unexpected validation error'),
            );
        }
    };
}