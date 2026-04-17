import { APIGatewayProxyResult } from 'aws-lambda';
import { OCPIResponse } from '/opt/nodejs/db/base.model';

export const prepareResponse = (data: unknown): APIGatewayProxyResult => ({
  statusCode: 200,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
      'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'OPTIONS,GET',
  },
  body: JSON.stringify(data),
});

export const prepareOCPIResponse = (data: unknown): APIGatewayProxyResult => ({
  statusCode: 200,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
      'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'OPTIONS,GET',
  },
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
