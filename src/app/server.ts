import { app } from './app';
import { env } from '../config/env';
import { logger } from '../config/logger';

/**
 * Starts the HTTP server.
 */
app.listen(env.port, () => {
    logger.info(
        {
            port: env.port,
            env: env.nodeEnv,
        },
        'Backend PoC server started',
    );
});