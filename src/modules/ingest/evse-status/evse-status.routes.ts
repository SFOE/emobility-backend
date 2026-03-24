import { Router } from 'express';
import { validateBody } from '../../../middleware/validate.middleware';
import { buildOcpiResponse } from '../../../shared/http/ocpi-response';
import {
    EvseStatusRequest,
    evseStatusRequestSchema,
} from './evse-status.schemas';

export const evseStatusRouter = Router();

/**
 * Accepts dynamic EVSE status payloads.
 */
evseStatusRouter.post(
    '/',
    validateBody(evseStatusRequestSchema),
    (req, res) => {
        const body = req.body as EvseStatusRequest;

        res.status(200).json(
            buildOcpiResponse({
                accepted: true,
                partner_id: req.partner?.id,
                status_count: body.statuses.length,
            }),
        );
    },
);