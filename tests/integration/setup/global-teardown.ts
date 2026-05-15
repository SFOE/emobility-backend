import { StartedTestContainer } from 'testcontainers';

declare global {
  var __MINISTACK_CONTAINER__: StartedTestContainer;
}

export default async function globalTeardown(): Promise<void> {
  await global.__MINISTACK_CONTAINER__?.stop();
}
