import {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResult,
} from 'aws-lambda';
import { ErrorHandler } from '/opt/nodejs/api/error/api-error-handler';
import { HttpError } from '/opt/nodejs/api/error/http-error';
import { prepareOCPIResponse } from '/opt/nodejs/utils/api.utils';
import { hasMonitoringAccess } from '/opt/nodejs/modules/monitoring/monitoring.auth';
import {
  fetchMonitoringItems,
  fetchRegisteredParties,
} from '/opt/nodejs/modules/monitoring/monitoring.db';
import { DEFAULT_STATUS_THRESHOLDS } from '/opt/nodejs/modules/monitoring/monitoring.model';
import { buildMonitoringResponse } from '/opt/nodejs/modules/monitoring/monitoring.service';

/**
 * Handles GET /monitoring/cpos for the E-Mobility Monitoring page: per-CPO
 * onboarding figures and status. With a JWT authorizer on the route, API
 * Gateway has already validated the Cognito access token; this handler then
 * requires the group from MONITORING_REQUIRED_GROUP (BFE staff) or an e-mail
 * address from MONITORING_ALLOWED_EMAILS (platform developers) and answers
 * 403 otherwise. CORS comes from the API Gateway, so no CORS headers are set
 * here.
 */
export const handler = async (
  event?: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResult> => {
  try {
    if (!hasMonitoringAccess(event)) {
      throw new HttpError('Forbidden', 403);
    }
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
