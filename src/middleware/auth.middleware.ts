import { NextFunction, Request, Response } from 'express';
import { findPartnerByToken } from '../modules/partners/partner.service';
import { buildOcpiErrorResponse } from '../shared/http/ocpi-response';

/**
 * Extracts the bearer token from the Authorization header.
 */
function extractBearerToken(authorizationHeader?: string): string | null {
    if (!authorizationHeader) {
        return null;
    }

    const [scheme, token] = authorizationHeader.split(' ');

    if (scheme !== 'Token' && scheme !== 'Bearer') {
        return null;
    }

    if (!token) {
        return null;
    }

    return token;
}

/**
 * Protects routes with token-based partner authentication.
 */
export function authMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    const token = extractBearerToken(req.header('Authorization'));

    if (!token) {
        return res
            .status(401)
            .json(buildOcpiErrorResponse(2001, 'Missing or invalid authorization'));
    }

    const partner = findPartnerByToken(token);

    if (!partner) {
        return res
            .status(401)
            .json(buildOcpiErrorResponse(2002, 'Unknown partner token'));
    }

    if (!partner.isActive) {
        return res
            .status(403)
            .json(buildOcpiErrorResponse(2003, 'Partner is inactive'));
    }

    req.partner = partner;
    next();
}