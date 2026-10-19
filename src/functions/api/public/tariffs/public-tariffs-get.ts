import { createGetObjectHandler } from '/opt/nodejs/modules/ocpi-public/ocpi-public.handlers';
import { PUBLIC_TARIFFS } from '/opt/nodejs/modules/ocpi-public/ocpi-public.model';

/**
 * Handles GET /tariffs/{country_code}/{party_id}/{tariff_id} (public, no auth).
 * Returns one valid OCPI 2.3.0 Tariff, or 404 / 2003.
 */
export const handler = createGetObjectHandler(PUBLIC_TARIFFS, 'tariff_id');
