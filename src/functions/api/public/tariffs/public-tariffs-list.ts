import { createListObjectsHandler } from '/opt/nodejs/modules/ocpi-public/ocpi-public.handlers';
import { PUBLIC_TARIFFS } from '/opt/nodejs/modules/ocpi-public/ocpi-public.model';

/**
 * Handles GET /tariffs?date_from=&offset=&limit= (public, no auth).
 * Returns a page of valid OCPI 2.3.0 Tariffs with OCPI pagination headers.
 */
export const handler = createListObjectsHandler(PUBLIC_TARIFFS);
