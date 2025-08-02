import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: [
    '<rootDir>/test/setup/test-utils.ts',
    '<rootDir>/client/src/__tests__/setup.ts'
  ],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/components/(.*)$': '<rootDir>/client/src/components/$1',
    '^@/pages/(.*)$': '<rootDir>/client/src/pages/$1',
    '^@/hooks/(.*)$': '<rootDir>/client/src/hooks/$1',
    '^@/lib/(.*)$': '<rootDir>/client/src/lib/$1',
    '^@/utils/(.*)$': '<rootDir>/client/src/utils/$1',
    '^@/types/(.*)$': '<rootDir>/client/src/types/$1',
    '^@/providers/(.*)$': '<rootDir>/client/src/providers/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@server/(.*)$': '<rootDir>/server/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': '<rootDir>/client/src/__tests__/__mocks__/fileMock.js'
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        moduleResolution: 'node',
        target: 'ES2020',
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        skipLibCheck: true,
        strict: true,
        forceConsistentCasingInFileNames: true,
        noEmit: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noUnusedLocals: false,
        noUnusedParameters: false
      }
    }],
    '^.+\\.(js|jsx)$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-react', { runtime: 'automatic' }],
        '@babel/preset-typescript'
      ]
    }]
  },
  testMatch: [
    '<rootDir>/test/**/*.test.ts',
    '<rootDir>/test/**/*.test.tsx',
    '<rootDir>/test/**/*.spec.ts',
    '<rootDir>/test/**/*.spec.tsx',
    '<rootDir>/client/src/**/*.test.ts',
    '<rootDir>/client/src/**/*.test.tsx',
    '<rootDir>/client/src/**/*.spec.ts',
    '<rootDir>/client/src/**/*.spec.tsx',
    '<rootDir>/server/**/*.test.ts',
    '<rootDir>/server/**/*.spec.ts'
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx,js,jsx}',
    'client/src/**/*.{ts,tsx,js,jsx}',
    'server/**/*.{ts,js}',
    'shared/**/*.{ts,js}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/build/**',
    '!**/coverage/**',
    '!**/*.test.{ts,tsx,js,jsx}',
    '!**/*.spec.{ts,tsx,js,jsx}',
    '!**/__tests__/**',
    '!**/__mocks__/**',
    '!**/test/**',
    '!**/tests/**'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/coverage/'
  ],
  transformIgnorePatterns: [
    '/node_modules/(?!(@tanstack/react-query|lucide-react|@radix-ui|wouter)/)'
  ],
  globals: {
    'ts-jest': {
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        moduleResolution: 'node',
        target: 'ES2020',
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        skipLibCheck: true,
        strict: true,
        forceConsistentCasingInFileNames: true,
        noEmit: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noUnusedLocals: false,
        noUnusedParameters: false
      }
    }
  },
  // React 19 specific configuration
  testEnvironmentOptions: {
    customExportConditions: ['react-jsx']
  },
  // Test timeout configuration
  testTimeout: 10000,
  // Verbose output for debugging
  verbose: true,
  // Clear mocks between tests
  clearMocks: true,
  // Restore mocks after each test
  restoreMocks: true,
  // Reset modules between tests
  resetModules: true,
  // Projects configuration for different test types
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/test/unit/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/test/setup/test-utils.ts']
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/test/integration/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/test/setup/test-utils.ts']
    },
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/test/e2e/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/test/setup/test-utils.ts']
    },
    {
      displayName: 'security',
      testMatch: ['<rootDir>/test/security/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/test/setup/test-utils.ts']
    },
    {
      displayName: 'performance',
      testMatch: ['<rootDir>/test/performance/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/test/setup/test-utils.ts']
    },
    {
      displayName: 'contract',
      testMatch: ['<rootDir>/test/contract/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/test/setup/test-utils.ts']
    },
    {
      displayName: 'accessibility',
      testMatch: ['<rootDir>/test/accessibility/**/*.test.tsx'],
      setupFilesAfterEnv: ['<rootDir>/test/setup/test-utils.ts']
    },
    {
      displayName: 'visual',
      testMatch: ['<rootDir>/test/visual/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/test/setup/test-utils.ts']
    }
  ],
  // Coverage reporters
  coverageReporters: [
    'text',
    'text-lcov',
    'html',
    'json',
    'json-summary'
  ],
  // Coverage directory
  coverageDirectory: 'coverage',
  // Collect coverage from specific files
  collectCoverageFrom: [
    'src/**/*.{ts,tsx,js,jsx}',
    'client/src/**/*.{ts,tsx,js,jsx}',
    'server/**/*.{ts,js}',
    'shared/**/*.{ts,js}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/build/**',
    '!**/coverage/**',
    '!**/*.test.{ts,tsx,js,jsx}',
    '!**/*.spec.{ts,tsx,js,jsx}',
    '!**/__tests__/**',
    '!**/__mocks__/**',
    '!**/test/**',
    '!**/tests/**',
    '!**/index.ts',
    '!**/main.tsx',
    '!**/vite-env.d.ts'
  ]
};

export default config;
