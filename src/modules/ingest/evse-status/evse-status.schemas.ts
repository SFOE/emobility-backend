import { z } from 'zod';

/**
 * Supported EVSE status values for the PoC.
 */
const evseStatusEnum = z.enum([
    'AVAILABLE',
    'CHARGING',
    'OCCUPIED',
    'OUTOFORDER',
    'PLANNED',
    'REMOVED',
    'UNKNOWN',
    'BLOCKED',
    'INOPERATIVE',
    'RESERVED',
]);

/**
 * Dynamic EVSE status entry.
 */
const evseStatusEntrySchema = z.object({
    location_id: z.string().min(1),
    evse_uid: z.string().min(1),
    status: evseStatusEnum,
    last_updated: z.string().datetime(),
});

/**
 * Incoming dynamic EVSE status payload.
 */
export const evseStatusRequestSchema = z.object({
    country_code: z.string().length(2),
    party_id: z.string().min(1).max(3),
    statuses: z.array(evseStatusEntrySchema).min(1),
});

export type EvseStatusRequest = z.infer<typeof evseStatusRequestSchema>;