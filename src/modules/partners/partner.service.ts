import { Partner } from './partner.types';

/**
 * In-memory partner registry used as a temporary PoC replacement for the database.
 */
const partners: Partner[] = [
    {
        id: 'cpo-test-1',
        name: 'Test CPO',
        token: 'test-token',
        environment: 'test',
        isActive: true,
    },
    {
        id: 'cpo-prod-1',
        name: 'Prod CPO',
        token: 'prod-token',
        environment: 'prod',
        isActive: true,
    },
];

/**
 * Finds a partner by its API token.
 */
export function findPartnerByToken(token: string): Partner | null {
    const partner = partners.find((entry) => entry.token === token);
    return partner ?? null;
}