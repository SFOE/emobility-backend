import { NextFunction, Request, Response } from 'express';
import { findPartnerByToken } from '../modules/partners/partner.service';
import { AppError } from '../shared/errors/app-error';
import { OcpiStatusCodes } from '../shared/errors/error-codes';

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
    _res: Response,
    next: NextFunction,
) {
    const token = extractBearerToken(req.header('Authorization'));

    if (!token) {
        return next(
            new AppError(
                'Missing or invalid authorization',
                401,
                OcpiStatusCodes.INVALID_PAYLOAD,
            ),
        );
    }

    const partner = findPartnerByToken(token);

    if (!partner) {
        return next(
            new AppError(
                'Unknown partner token',
                401,
                OcpiStatusCodes.UNKNOWN_PARTNER_TOKEN,
            ),
        );
    }

    if (!partner.isActive) {
        return next(
            new AppError(
                'Partner is inactive',
                403,
                OcpiStatusCodes.INACTIVE_PARTNER,
            ),
        );
    }

    req.partner = partner;
    next();
}