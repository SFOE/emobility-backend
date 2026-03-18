import { z } from 'zod';

/**
 * Geographic coordinates of a location.
 */
const geoLocationSchema = z.object({
    latitude: z.string().min(1),
    longitude: z.string().min(1),
});

/**
 * Connector definition of an EVSE.
 */
const connectorSchema = z.object({
    id: z.string().min(1),
    standard: z.string().min(1),
    format: z.string().min(1),
    power_type: z.string().min(1),
    max_voltage: z.number().int().positive(),
    max_amperage: z.number().int().positive(),
    last_updated: z.string().datetime(),
});

/**
 * EVSE definition within a location.
 */
const evseSchema = z.object({
    uid: z.string().min(1),
    status: z.string().min(1),
    connectors: z.array(connectorSchema).min(1),
    last_updated: z.string().datetime(),
});

/**
 * Static location payload for the PoC.
 */
const locationSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1).optional(),
    address: z.string().min(1),
    city: z.string().min(1),
    postal_code: z.string().min(1),
    country: z.string().length(3),
    coordinates: geoLocationSchema,
    evses: z.array(evseSchema).min(1),
    last_updated: z.string().datetime(),
});

/**
 * Incoming static EVSE data payload.
 */
export const evseDataRequestSchema = z.object({
    country_code: z.string().length(2),
    party_id: z.string().min(1).max(3),
    locations: z.array(locationSchema).min(1),
});

export type EvseDataRequest = z.infer<typeof evseDataRequestSchema>;