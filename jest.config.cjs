/** @type {import('jest').Config} */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { pathsToModuleNameMapper } = require('ts-jest');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { compilerOptions } = require('./tsconfig.paths.json');  // Changed to read directly from paths file

const config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup-test-env.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  collectCoverageFrom: [
    'shared/utils/**/*.ts',
    'server/**/*.ts',
    '!server/**/*.d.ts',
    '!server/db/migrations/**/*.ts',
    '!server/**/*.test.ts',
    '!server/**/*.spec.ts',
    '!server/index.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths || {}, { prefix: '<rootDir>/' }),
  moduleDirectories: ['node_modules', '<rootDir>'],
  transform: {
    '^.+\\.m?[tj]sx?$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.server.json',
      useESM: true,
      isolatedModules: false, 
    }]
  },
  // Rest of the configuration remains the same
};

module.exports = config;