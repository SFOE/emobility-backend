import { Request, Response } from 'express';
import { buildOcpiErrorResponse } from '../shared/http/ocpi-response';

/**
 * Handles unknown routes.
 */
export function notFoundMiddleware(_req: Request, res: Response) {
    res.status(404).json(buildOcpiErrorResponse(2000, 'Route not found'));
}