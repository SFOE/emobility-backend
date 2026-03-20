import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { healthRouter } from '../modules/health/health.routes';
import { credentialsRouter } from '../modules/auth/credentials.routes';
import { ocpiDetailsRouter } from '../modules/ocpi/details/details.routes';
import { ocpiVersionsRouter } from '../modules/ocpi/versions/versions.routes';
import { evseDataRouter } from '../modules/ingest/evse-data/evse-data.routes';
import { evseStatusRouter } from '../modules/ingest/evse-status/evse-status.routes';

export const appRouter = Router();

/**
 * Registers all application routes.
 */
appRouter.use('/health', healthRouter);
appRouter.use('/ocpi/versions', ocpiVersionsRouter);
appRouter.use('/ocpi/2.3.0/details', ocpiDetailsRouter);
appRouter.use('/ocpi/2.3.0/credentials', credentialsRouter);

/**
 * Protected ingest routes for authenticated CPOs.
 */
appRouter.use('/ingest/ocpi/2.3.0/evse-data', authMiddleware, evseDataRouter);
appRouter.use(
    '/ingest/ocpi/2.3.0/evse-status',
    authMiddleware,
    evseStatusRouter,
);