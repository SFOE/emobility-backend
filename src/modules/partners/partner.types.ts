/**
 * Minimal partner model used for the PoC authentication flow.
 */
export interface Partner {
    id: string;
    name: string;
    token: string;
    environment: 'test' | 'prod';
    isActive: boolean;
}