import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';

declare global {
  var __MINISTACK_CONTAINER__: StartedTestContainer;
}

export default async function globalSetup(): Promise<void> {
  const container = await new GenericContainer('ministackorg/ministack')
    .withExposedPorts(4566)
    .withWaitStrategy(Wait.forHttp('/_ministack/health', 4566))
    .withStartupTimeout(60_000)
    .start();

  const endpoint = `http://localhost:${container.getMappedPort(4566)}`;

  // Store reference so globalTeardown (same process) can stop it
  global.__MINISTACK_CONTAINER__ = container;

  // Set before workers spawn so SDK clients inherit the Ministack endpoint.
  process.env.AWS_ENDPOINT_URL_DYNAMODB = endpoint;
  process.env.AWS_ENDPOINT_URL_SECRETS_MANAGER = endpoint;
  process.env.AWS_ENDPOINT_URL_S3 = endpoint;
  process.env.AWS_S3_FORCE_PATH_STYLE = 'true';
  process.env.AWS_ENDPOINT_URL_SQS = endpoint;
  process.env.AWS_ACCESS_KEY_ID = 'test';
  process.env.AWS_SECRET_ACCESS_KEY = 'test';
  process.env.MINISTACK_ENDPOINT = endpoint;
  process.env.BASE_URL = 'https://bfe-integration-test.example.com';
  // Ministack uses account 000000000000 by default; set the full queue URL so handler clients can resolve it locally.
  process.env.SQS_INGESTION_QUEUE_URL = `${endpoint}/000000000000/emobility-dev-ocpi-ingestion-queue`;
}
