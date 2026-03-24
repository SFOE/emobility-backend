
/**
 * Central OCPI-like status codes used by the PoC.
 */
export const OcpiStatusCodes = {
    SUCCESS: 1000,

    ROUTE_NOT_FOUND: 2000,
    INVALID_PAYLOAD: 2001,
    UNKNOWN_PARTNER_TOKEN: 2002,
    INACTIVE_PARTNER: 2003,

    INTERNAL_SERVER_ERROR: 3000,
} as const;