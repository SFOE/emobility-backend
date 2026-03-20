import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

/**
 * Attaches a unique request id to each incoming request.
 */
export function requestContextMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    const requestId = randomUUID();

    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    next();
}