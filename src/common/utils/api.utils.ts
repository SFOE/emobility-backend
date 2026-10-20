import { APIGatewayProxyResult } from 'aws-lambda';
import { OCPIResponse } from '/opt/nodejs/api/base.model';

const OCPI_HEADERS = {
  'Content-Type': 'application/json',
};

// `headers` adds response headers, e.g. OCPI's pagination headers
// (Link, X-Total-Count, X-Limit).
export const prepareOCPIResponse = (
  data: unknown,
  headers: Record<string, string> = {},
): APIGatewayProxyResult => ({
  statusCode: 200,
  headers: { ...OCPI_HEADERS, ...headers },
  body: JSON.stringify(ocpiSuccess(data)),
});

const ocpiSuccess = <T>(
  data: T,
  statusMessage = 'Success',
): OCPIResponse<T> => {
  return {
    data,
    status_code: 1000,
    status_message: statusMessage,
    timestamp: new Date().toISOString(),
  };
};

/**
 * Returns a required Lambda environment variable or fails fast during startup
 * if the runtime configuration is incomplete.
 */
export const getRequiredLambdaEnv = (name: string): string => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required Lambda environment variable: ${name}`);
  }

  return value;
};
