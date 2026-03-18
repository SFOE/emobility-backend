import { Router } from 'express';
import { validateBody } from '../../middleware/validate.middleware';
import { buildOcpiResponse } from '../../shared/http/ocpi-response';
import {
    CredentialsRequest,
    credentialsRequestSchema,
} from './credentials.schemas';

export const credentialsRouter = Router();

/**
 * Accepts OCPI credentials handshake payloads.
 */
credentialsRouter.post(
    '/',
    validateBody(credentialsRequestSchema),
    (req, res) => {
        const body = req.body as CredentialsRequest;

        res.status(200).json(
            buildOcpiResponse({
                accepted: true,
                received_roles: body.roles.length,
                version: '2.3.0',
            }),
        );
    },
);