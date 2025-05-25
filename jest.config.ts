import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup-test-env.ts'],
  moduleNameMapper: {
    '^@server/(.*)$': '<rootDir>/server/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@test/(.*)$': '<rootDir>/tests/$1'
  },
  moduleDirectories: ['node_modules', '<rootDir>'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.server.json'
    }]
  },
  testMatch: [
    '**/tests/**/*.test.ts',
    '**/tests/**/*.spec.ts'
  ],
  collectCoverage: true,
  collectCoverageFrom: [
    'shared/utils/**/*.ts',
    'server/services/base/enhanced-service.ts',
    'server/services/**/formatter.ts'
  ],
  coverageReporters: ['text', 'lcov'],
  coverageDirectory: 'coverage',
  verbose: true
};

export default config;
