module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/unit'],
  testMatch: ['**/?(*.)+(spec|test).ts'],
  testPathIgnorePatterns: ['/node_modules/'],
  moduleNameMapper: {
    '^/opt/nodejs/(.*)$': '<rootDir>/src/common/$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: './tests/tsconfig.json' }],
  },
  collectCoverageFrom: ['src/**/*.ts'],
  coverageDirectory: 'coverage/unit',
  coverageReporters: ['text', 'lcov', 'html'],
  silent: true
};
