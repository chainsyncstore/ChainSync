/** @type {import('jest').Config} */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { pathsToModuleNameMapper } = require('ts-jest');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { compilerOptions } = require('./tsconfig.server.json');

const config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup-test-env.ts'],
  extensionsToTreatAsEsm: ['.ts'], // Added this line
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths || {}, { prefix: '<rootDir>/' }),
  moduleDirectories: ['node_modules', '<rootDir>'],
  transform: {
    '^.+\\.m?[tj]sx?$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.server.json',
      useESM: true,
      // isolatedModules: true, // Recommended for ESM with ts-jest, but let's keep the user's 'false' for now if it was intentional.
                               // Re-evaluating: The previous config had isolatedModules: false. Let's stick to that unless issues arise.
      isolatedModules: false, 
    }]
  },
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/dist/', '<rootDir>/test/e2e/'],
  testMatch: [
    '**/tests/**/*.test.ts',
    '**/test/**/*.test.ts',
    '**/server/**/*.test.ts', // Added to include tests within server directory
    '**/test/integration/**/*.test.ts',
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

module.exports = config;
