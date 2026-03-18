import { z } from 'zod';

/**
 * Valid OCPI role names for the PoC.
 */
const roleEnum = z.enum(['CPO', 'EMSP', 'HUB', 'NAP']);

/**
 * Business details of the remote party.
 */
const businessDetailsSchema = z.object({
    name: z.string().min(1),
    website: z.string().url().optional(),
});

/**
 * Role definition used in the credentials payload.
 */
const credentialsRoleSchema = z.object({
    role: roleEnum,
    business_details: businessDetailsSchema,
    country_code: z.string().length(2),
    party_id: z.string().min(1).max(3),
});

/**
 * Incoming credentials payload for OCPI handshake.
 */
export const credentialsRequestSchema = z.object({
    token: z.string().min(1),
    url: z.string().url(),
    roles: z.array(credentialsRoleSchema).min(1),
});

export type CredentialsRequest = z.infer<typeof credentialsRequestSchema>;