import express from 'express';
import pinoHttp from 'pino-http';
import { logger } from '../config/logger';
import { errorMiddleware } from '../middleware/error.middleware';
import { notFoundMiddleware } from '../middleware/not-found.middleware';
import { appRouter } from './routes';

export const app = express();

// Parses incoming JSON payloads.
app.use(express.json());

// Adds structured request logging.
app.use(
    pinoHttp({
        logger,
    }),
);

// Registers all application routes
app.use(appRouter);

// Handles unknown routes.
app.use(notFoundMiddleware);

// Handles unexpected application errors
app.use(errorMiddleware);