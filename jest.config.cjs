/** @type {import('jest').Config} */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { pathsToModuleNameMapper } = require('ts-jest');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { compilerOptions } = require('./tsconfig.server.json');

const config = {
  preset: 'ts-jest/presets/default-esm', // Reinstated preset
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup-test-env.ts'],
  // resolver: 'ts-jest/resolver', // Keep removed
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths || {}, { prefix: '<rootDir>/' }),
  moduleDirectories: ['node_modules', '<rootDir>'],
  transform: {
    '^.+\\.m?[tj]sx?$': ['ts-jest', { // More comprehensive regex for ESM
      tsconfig: '<rootDir>/tsconfig.server.json',
      useESM: true,
      isolatedModules: false, // Explicitly set
    }]
  },
  // extensionsToTreatAsEsm and moduleFileExtensions should be handled by the preset
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/dist/', '<rootDir>/test/e2e/'],
  testMatch: [
    '**/tests/**/*.test.ts',
    '**/test/**/*.test.ts',
    // Kept for now, review if only .test.ts is used for Jest
    '**/test/**/*.spec.ts',
    '**/test/integration/**/*.test.ts'
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
