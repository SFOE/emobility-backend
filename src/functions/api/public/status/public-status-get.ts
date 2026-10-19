import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { ErrorHandler } from '/opt/nodejs/api/error/api-error-handler';
import { getEvseStatus } from '/opt/nodejs/modules/ocpi-public/ocpi-public.db';
import { parsePublicPathParams } from '/opt/nodejs/modules/ocpi-public/ocpi-public.handlers';
import { prepareOCPIResponse } from '/opt/nodejs/utils/api.utils';

/**
 * Handles GET /status/{country_code}/{party_id}/{location_id}/evses/{evse_uid}
 * (public, no auth). Returns the EVSE's live status `{status, last_updated}`
 * from ocpi-evse-current-status, or 404 / 2003.
 */
export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> => {
  try {
    const parsed = parsePublicPathParams(event);
    if (!parsed.success) {
      return parsed.error;
    }
    const { country_code, party_id, location_id, evse_uid } = parsed.params;

    const status = await getEvseStatus(
      country_code!,
      party_id!,
      location_id!,
      evse_uid!,
    );
    if (status === null) {
      return ErrorHandler.handleBadRequestError(
        2003,
        'EVSE status not found',
        404,
      );
    }
    return prepareOCPIResponse(status);
  } catch (err) {
    return ErrorHandler.handleError(err);
  }
};
