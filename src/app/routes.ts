import { Router } from 'express';
import { healthRouter } from '../modules/health/health.routes';
import { ocpiVersionsRouter } from '../modules/ocpi/versions/versions.routes';
import { ocpiDetailsRouter } from '../modules/ocpi/details/details.routes';

export const appRouter = Router();

/**
 * Registers all application routes.
 */
appRouter.use('/health', healthRouter);
appRouter.use('/ocpi/versions', ocpiVersionsRouter);
appRouter.use('/ocpi/2.3.0/details', ocpiDetailsRouter);