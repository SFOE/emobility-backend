import { Router } from 'express';
import { env } from '../../../config/env';
import { buildOcpiResponse } from '../../../shared/http/ocpi-response';

export const ocpiDetailsRouter = Router();

/**
 * Returns the available endpoints for the configured OCPI version.
 */
ocpiDetailsRouter.get('/', (_req, res) => {
    const endpoints = {
        version: env.ocpiVersion,
        endpoints: [
            {
                identifier: 'credentials',
                role: 'RECEIVER',
                url: `${env.ocpiBaseUrl}/ocpi/${env.ocpiVersion}/credentials`,
            },
            {
                identifier: 'evse-data',
                role: 'RECEIVER',
                url: `${env.ocpiBaseUrl}/ingest/ocpi/${env.ocpiVersion}/evse-data`,
            },
            {
                identifier: 'evse-status',
                role: 'RECEIVER',
                url: `${env.ocpiBaseUrl}/ingest/ocpi/${env.ocpiVersion}/evse-status`,
            },
        ],
    };

    res.status(200).json(buildOcpiResponse(endpoints));
});