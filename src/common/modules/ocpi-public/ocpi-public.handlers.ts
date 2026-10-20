import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { ErrorHandler } from '/opt/nodejs/api/error/api-error-handler';
import { prepareOCPIResponse } from '/opt/nodejs/utils/api.utils';
import {
  assertValidPathIdentifiers,
  getRequiredBaseUrl,
  OcpiPathParams,
  parsePathParams,
} from '/opt/nodejs/utils/ocpi-guards';
import { getPublicObject, listPublicObjects } from './ocpi-public.db';
import { PublicObjectType } from './ocpi-public.model';
import { buildPaginationHeaders, parseListQuery } from './ocpi-public.params';

/**
 * Handlers of the public, unauthenticated OCPI read API. Locations and tariffs
 * behave identically apart from their table, so both are built from these
 * factories; the Lambda entry points under functions/api/public/ only bind the
 * object type.
 */

// Public routes carry no authorizer context, so the caller is logged as such.
const PUBLIC_CALLER = 'public';

type PublicHandler = (
  event: APIGatewayProxyEventV2,
) => Promise<APIGatewayProxyResult>;

/**
 * Normalizes and validates the path ids (same rules as the CPO-facing API,
 * which also keeps '#' out of DynamoDB keys - so `#META` is unreachable).
 */
export const parsePublicPathParams = (
  event: APIGatewayProxyEventV2,
):
  | { success: true; params: OcpiPathParams }
  | { success: false; error: APIGatewayProxyResult } => {
  const params = parsePathParams(event);
  const error = assertValidPathIdentifiers(
    params,
    event.routeKey,
    PUBLIC_CALLER,
  );
  return error ? { success: false, error } : { success: true, params };
};

// The Glue-written bodies are serialized OCPI objects; parse them into `data`.
const parseBodies = (bodies: string[]): unknown[] =>
  bodies.map((body) => JSON.parse(body));

// GET {path}/{country_code}/{party_id}/{id}
export const createGetObjectHandler =
  (
    type: PublicObjectType,
    idParam: 'location_id' | 'tariff_id',
  ): PublicHandler =>
  async (event) => {
    try {
      const parsed = parsePublicPathParams(event);
      if (!parsed.success) {
        return parsed.error;
      }
      const { country_code, party_id } = parsed.params;
      const id = parsed.params[idParam];

      const body = await getPublicObject(type, country_code!, party_id!, id!);
      if (body === null) {
        return ErrorHandler.handleBadRequestError(
          2003,
          `${type.label} not found`,
          404,
        );
      }
      return prepareOCPIResponse(JSON.parse(body));
    } catch (err) {
      return ErrorHandler.handleError(err);
    }
  };

// GET {path}?date_from=&offset=&limit=
export const createListObjectsHandler =
  (type: PublicObjectType): PublicHandler =>
  async (event) => {
    try {
      const parsed = parseListQuery(event.queryStringParameters);
      if (!parsed.success) {
        return parsed.error;
      }
      const query = parsed.value;

      const page = await listPublicObjects(type, query);
      return prepareOCPIResponse(
        parseBodies(page.bodies),
        buildPaginationHeaders(
          getRequiredBaseUrl(),
          type.path,
          query,
          page.bodies.length,
          page.total,
        ),
      );
    } catch (err) {
      return ErrorHandler.handleError(err);
    }
  };
