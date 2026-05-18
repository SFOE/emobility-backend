import { APIGatewayProxyResult } from 'aws-lambda';
import { OCPIResponse } from '/opt/nodejs/api/base.model';

const OCPI_HEADERS = {
  'Content-Type': 'application/json',
};

export const prepareOCPIResponse = (data: unknown): APIGatewayProxyResult => ({
  statusCode: 200,
  headers: OCPI_HEADERS,
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
