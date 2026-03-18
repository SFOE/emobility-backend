import { Router } from 'express';
import { validateBody } from '../../../middleware/validate.middleware';
import { buildOcpiResponse } from '../../../shared/http/ocpi-response';
import {
    EvseDataRequest,
    evseDataRequestSchema,
} from './evse-data.schemas';

export const evseDataRouter = Router();

/**
 * Accepts static EVSE data payloads.
 */
evseDataRouter.post('/', validateBody(evseDataRequestSchema), (req, res) => {
    const body = req.body as EvseDataRequest;

    const evseCount = body.locations.reduce(
        (sum, location) => sum + location.evses.length,
        0,
    );

    res.status(200).json(
        buildOcpiResponse({
            accepted: true,
            location_count: body.locations.length,
            evse_count: evseCount,
        }),
    );
});