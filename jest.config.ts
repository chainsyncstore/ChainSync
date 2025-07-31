import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup-test-env.ts'],
  moduleNameMapper: {
    '^\.\./src/cache/redis\.js$': '<rootDir>/tests/__mocks__/redis.js',
        '^@db$': '<rootDir>/tests/__mocks__/db.js',
    '^@db/(.*)$': '<rootDir>/tests/__mocks__/db.js',
    // Mock external packages not included in test env
    '^@opentelemetry/sdk-node$': '<rootDir>/tests/__mocks__/otlp-sdk-node.js',
    '^@opentelemetry/auto-instrumentations-node$': '<rootDir>/tests/__mocks__/otlp-sdk-node.js',
    '^@opentelemetry/exporter-trace-otlp-http$': '<rootDir>/tests/__mocks__/otlp-exporter.js',
    '^@opentelemetry/instrumentation-redis$': '<rootDir>/tests/__mocks__/redis-instrumentation.js',
    '^@server/services/payment$': '<rootDir>/tests/__mocks__/payment-service.js',
    '^@server/services/loyalty\.js$': '<rootDir>/tests/__mocks__/loyalty-service.js',
    '^.*src/logging.*$': '<rootDir>/tests/__mocks__/logger.js',
    '^(?:\.\./)+src/logging$': '<rootDir>/tests/__mocks__/logger.js',
    '^src/logging/index$': '<rootDir>/tests/__mocks__/logger.js',
    '^.+/src/logging/Logger$': '<rootDir>/tests/__mocks__/logger.js',
    '^@prisma/client$': '<rootDir>/tests/__mocks__/prisma-client.js',
    '^.+/db$': '<rootDir>/tests/__mocks__/db.js',
    '^.+/src/logging/index$': '<rootDir>/tests/__mocks__/logger.js',
    '^@server/(.*)$': '<rootDir>/server/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@test/(.*)$': '<rootDir>/tests/$1',
    '^(?:\\.\\./)*factories/(.*)\\.js$': '<rootDir>/tests/factories/$1.ts',
    '^(?:\\.\\./)*factories/(.*)$': '<rootDir>/tests/factories/$1',
    '^factories/(.*)$': '<rootDir>/tests/factories/$1',
    '^@server/services/loyalty\\.js$': '<rootDir>/server/services/loyalty.ts',
    '^@server/services/(.*)\\.js$': '<rootDir>/server/services/$1.ts',
    '^@server/(.*)\\.js$': '<rootDir>/server/$1.ts',
    '^@shared/schema-validation(\\.js)?$': '<rootDir>/shared/schema-validation.ts',
    '^@shared/(.*)\\.js$': '<rootDir>/shared/$1.ts',
    '^@db/(.*)\\.js$': '<rootDir>/db/$1.ts',
    '^\\.\\/middleware\\/security\\.js$': '<rootDir>/tests/__mocks__/security-middleware.js',
    '^\\.\\/middleware\\/rate-limit\\.js$': '<rootDir>/tests/__mocks__/rate-limit.js',
    '^\\.\\/src\\/cache\\/redis\\.js$': '<rootDir>/tests/__mocks__/redis.js',
  },
  moduleDirectories: ['node_modules', '<rootDir>'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  modulePathIgnorePatterns: ['<rootDir>/dist', '<rootDir>/server/__mocks__/vite.js'],
  
  transform: {
    '^.+\\.jsx?$': [
      'ts-jest', {
         tsconfig: '<rootDir>/tsconfig.test.json',
         diagnostics: false,
         allowJs: true,
       },
    ],
    '^.+\\.tsx?$': [
      'ts-jest', {
         tsconfig: '<rootDir>/tsconfig.test.json',
         diagnostics: false,
       },
    ],
  },
  testMatch: ['**/tests/**/*.test.ts', '**/tests/**/*.spec.ts'],
  testPathIgnorePatterns: ['<rootDir>/test/'],
  collectCoverage: true,
  collectCoverageFrom: [
    'shared/utils/**/*.ts',
    'server/services/base/enhanced-service.ts',
    'server/services/**/formatter.ts',
  ],
  coverageReporters: ['text', 'lcov'],
  coverageDirectory: 'coverage',
  transformIgnorePatterns: [
    "/node_modules/(?!drizzle-orm)/",
  ],
  verbose: true,
};

export default config;
