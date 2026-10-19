import { createListObjectsHandler } from '/opt/nodejs/modules/ocpi-public/ocpi-public.handlers';
import { PUBLIC_LOCATIONS } from '/opt/nodejs/modules/ocpi-public/ocpi-public.model';

/**
 * Handles GET /locations?date_from=&offset=&limit= (public, no auth).
 * Returns a page of published OCPI 2.3.0 Locations with OCPI pagination headers.
 */
export const handler = createListObjectsHandler(PUBLIC_LOCATIONS);
