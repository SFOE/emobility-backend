import express from 'express';
import pinoHttp from 'pino-http';
import { logger } from '../config/logger';
import { errorMiddleware } from '../middleware/error.middleware';
import { notFoundMiddleware } from '../middleware/not-found.middleware';
import { requestContextMiddleware } from '../middleware/request-context.middleware';
import { appRouter } from './routes';

export const app = express();

/**
 * Parses incoming JSON payloads.
 */
app.use(express.json());

/**
 * Attaches request metadata.
 */
app.use(requestContextMiddleware);

/**
 * Adds structured request logging.
 */
app.use(
    pinoHttp({
        logger,
        customProps(req) {
            return {
                requestId: req.requestId,
                partnerId: req.partner?.id,
            };
        },
    }),
);

/**
 * Registers all application routes.
 */
app.use(appRouter);

/**
 * Handles unknown routes.
 */
app.use(notFoundMiddleware);

/**
 * Handles unexpected application errors.
 */
app.use(errorMiddleware);