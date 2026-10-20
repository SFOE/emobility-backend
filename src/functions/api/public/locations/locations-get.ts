import { createGetObjectHandler } from '/opt/nodejs/modules/ocpi-public/ocpi-public.handlers';
import { PUBLIC_LOCATIONS } from '/opt/nodejs/modules/ocpi-public/ocpi-public.model';

/**
 * Handles GET /ocpi/locations/{country_code}/{party_id}/{location_id} (public, no auth).
 * Returns one published OCPI 2.3.0 Location, or 404 / 2003.
 */
export const handler = createGetObjectHandler(PUBLIC_LOCATIONS, 'location_id');
