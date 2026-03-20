import 'express';

/**
 * Minimal partner context attached to authenticated requests.
 */
interface AuthenticatedPartner {
    id: string;
    name: string;
    token: string;
    environment: 'test' | 'prod';
    isActive: boolean;
}

declare module 'express-serve-static-core' {
    interface Request {
        requestId?: string;
        partner?: AuthenticatedPartner;
    }
}