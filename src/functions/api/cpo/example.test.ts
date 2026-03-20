import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { handler } from './example';

describe('Example Lambda Handler', () => {
  const mockContext: Context = {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'test-function',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test',
    memoryLimitInMB: '128',
    awsRequestId: 'test-request-id',
    logGroupName: '/aws/lambda/test',
    logStreamName: '2024/01/01/[$LATEST]test',
    getRemainingTimeInMillis: () => 30000,
    done: () => {},
    fail: () => {},
    succeed: () => {},
  };

  it('should return 200 with success message', async () => {
    const mockEvent = {
      body: null,
      headers: {},
      httpMethod: 'GET',
      path: '/test',
      queryStringParameters: null,
    } as APIGatewayProxyEvent;

    const result = await handler(mockEvent, mockContext);

    expect(result.statusCode).toBe(200);
    expect(result.headers).toHaveProperty('Content-Type', 'application/json');

    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('message', 'Hello from eMobility Backend!');
    expect(body).toHaveProperty('requestId', 'test-request-id');
  });
});
