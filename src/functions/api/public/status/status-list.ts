import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { ErrorHandler } from '/opt/nodejs/api/error/api-error-handler';
import { listEvseStatusesSince } from '/opt/nodejs/modules/ocpi-public/ocpi-public.db';
import {
  parseListQuery,
  STATUS_LIMIT,
} from '/opt/nodejs/modules/ocpi-public/ocpi-public.params';
import { prepareOCPIResponse } from '/opt/nodejs/utils/api.utils';

/**
 * Handles GET /ocpi/status?date_from=&limit= (public, no auth). Returns the current
 * statuses received at or after `date_from`, oldest first, capped at `limit`
 * (default and maximum 5000). Not paginated (no offset, no Link) - the volumes
 * are small.
 */
export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> => {
  try {
    const parsed = parseListQuery(event.queryStringParameters, {
      requireDateFrom: true,
      allowOffset: false,
      // received_at is written with Date#toISOString, so compare in that format.
      formatDateFrom: (instant) => instant.toISOString(),
      defaultLimit: STATUS_LIMIT,
      maxLimit: STATUS_LIMIT,
    });
    if (!parsed.success) {
      return parsed.error;
    }
    const { dateFrom, limit } = parsed.value;

    const statuses = await listEvseStatusesSince(dateFrom!, limit);
    return prepareOCPIResponse(statuses);
  } catch (err) {
    return ErrorHandler.handleError(err);
  }
};
