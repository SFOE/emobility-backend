import { APIGatewayProxyResult } from 'aws-lambda';

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
