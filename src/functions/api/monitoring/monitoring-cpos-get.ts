import { APIGatewayProxyResult } from 'aws-lambda';
import { ErrorHandler } from '/opt/nodejs/api/error/api-error-handler';
import { prepareOCPIResponse } from '/opt/nodejs/utils/api.utils';
import {
  fetchMonitoringItems,
  fetchRegisteredParties,
} from '/opt/nodejs/modules/monitoring/monitoring.db';
import { DEFAULT_STATUS_THRESHOLDS } from '/opt/nodejs/modules/monitoring/monitoring.model';
import { buildMonitoringResponse } from '/opt/nodejs/modules/monitoring/monitoring.service';

/**
 * Handles GET /monitoring/cpos (no authentication for now) for the E-Mobility
 * Monitoring page: per-CPO onboarding figures and status. CORS comes from the
 * API Gateway, so no CORS headers are set here.
 */
export const handler = async (): Promise<APIGatewayProxyResult> => {
  try {
    const [parties, { cpos, summary }] = await Promise.all([
      fetchRegisteredParties(),
      fetchMonitoringItems(),
    ]);
    return prepareOCPIResponse(
      buildMonitoringResponse(
        parties,
        cpos,
        summary,
        new Date(),
        DEFAULT_STATUS_THRESHOLDS,
      ),
    );
  } catch (err) {
    return ErrorHandler.handleError(err);
  }
};
