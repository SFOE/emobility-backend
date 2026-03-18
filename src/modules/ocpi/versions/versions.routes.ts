import { Router } from 'express';
import { env } from '../../../config/env';
import { buildOcpiResponse } from '../../../shared/http/ocpi-response';

export const ocpiVersionsRouter = Router();

/**
 * Returns the supported OCPI versions.
 */
ocpiVersionsRouter.get('/', (_req, res) => {
    const versions = [
        {
            version: env.ocpiVersion,
            url: `${env.ocpiBaseUrl}/ocpi/${env.ocpiVersion}/details`,
        },
    ];

    res.status(200).json(buildOcpiResponse(versions));
});