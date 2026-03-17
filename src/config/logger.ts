import { pino } from 'pino';
import { env } from './env';

/**
 * Shared application logger.
 */
export const logger = pino({
    level: env.logLevel,
});