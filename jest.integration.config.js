module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.integration.test.ts'],
  moduleNameMapper: {
    '^/opt/nodejs/(.*)$': '<rootDir>/src/common/$1',
  },
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  globalSetup: '<rootDir>/src/test/integration/global-setup.ts',
  globalTeardown: '<rootDir>/src/test/integration/global-teardown.ts',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.integration.test.ts',
    '!src/test/**/*.ts',
  ],
  coverageDirectory: 'coverage/integration',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 60000,
  silent: true,
};
