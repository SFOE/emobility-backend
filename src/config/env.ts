import 'dotenv/config'

/**
 * Centralized environment configuration.
 */
export const env = {
    port: Number(process.env.PORT || 3000),
    nodeEnv: process.env.NODE_ENV || 'development',
    ocpiBaseUrl: process.env.OCPI_BASE_URL || 'http://localhost:3000',
    ocpiVersion: process.env.OCPI_VERSION || '2.3.0',
    logLevel: process.env.LOG_LEVEL || 'info',
};