import express from 'express';

import pinoHttp from 'pino-http';
import { appRouter } from './routes';
import { logger } from '../config/logger';

export const app = express();

// Parses incoming JSON payloads.
app.use(express.json());

// Adds structured request logging.
app.use(
    pinoHttp({
        logger,
    }),
);

// Registers all application routes.
app.use(appRouter);