module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/integration'],
  testMatch: ['**/*.integration.test.ts'],
  maxWorkers: 1,
  moduleNameMapper: {
    '^/opt/nodejs/(.*)$': '<rootDir>/src/common/$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: './tsconfig.test.json' }],
  },
  globalSetup: '<rootDir>/tests/integration/setup/global-setup.ts',
  globalTeardown: '<rootDir>/tests/integration/setup/global-teardown.ts',
  collectCoverageFrom: ['src/**/*.ts'],
  coverageDirectory: 'coverage/integration',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 60000,
  silent: true,
};
