import { Router } from 'express';

export const healthRouter = Router();

/**
 * Basic health endpoint for local checks.
 */
healthRouter.get('/', (_req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
    });
});