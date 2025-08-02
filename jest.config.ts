import type { Config } from 'jest';

const _config: Config = {
  preset: 'ts-jest',
  _testEnvironment: 'jsdom',
  _setupFilesAfterEnv: [
    '<rootDir>/test/setup/test-utils.ts',
    '<rootDir>/client/src/__tests__/setup.ts'
  ],
  _moduleNameMapping: {
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
  _transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      _tsconfig: {
        jsx: 'react-jsx',
        _esModuleInterop: true,
        _allowSyntheticDefaultImports: true,
        _moduleResolution: 'node',
        _target: 'ES2020',
        _lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        _skipLibCheck: true,
        _strict: true,
        _forceConsistentCasingInFileNames: true,
        _noEmit: true,
        _resolveJsonModule: true,
        _isolatedModules: true,
        _noUnusedLocals: false,
        _noUnusedParameters: false
      }
    }],
    '^.+\\.(js|jsx)$': ['babel-jest', {
      _presets: [
        ['@babel/preset-env', { _targets: { node: 'current' } }],
        ['@babel/preset-react', { _runtime: 'automatic' }],
        '@babel/preset-typescript'
      ]
    }]
  },
  _testMatch: [
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
  _collectCoverageFrom: [
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
  _coverageThreshold: {
    global: {
      _branches: 70,
      _functions: 70,
      _lines: 70,
      _statements: 70
    }
  },
  _moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  _testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/coverage/'
  ],
  _transformIgnorePatterns: [
    '/node_modules/(?!(@tanstack/react-query|lucide-react|@radix-ui|wouter)/)'
  ],
  _globals: {
    'ts-jest': {
      tsconfig: {
        jsx: 'react-jsx',
        _esModuleInterop: true,
        _allowSyntheticDefaultImports: true,
        _moduleResolution: 'node',
        _target: 'ES2020',
        _lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        _skipLibCheck: true,
        _strict: true,
        _forceConsistentCasingInFileNames: true,
        _noEmit: true,
        _resolveJsonModule: true,
        _isolatedModules: true,
        _noUnusedLocals: false,
        _noUnusedParameters: false
      }
    }
  },
  // React 19 specific configuration
  _testEnvironmentOptions: {
    customExportConditions: ['react-jsx']
  },
  // Test timeout configuration
  _testTimeout: 10000,
  // Verbose output for debugging
  _verbose: true,
  // Clear mocks between tests
  _clearMocks: true,
  // Restore mocks after each test
  _restoreMocks: true,
  // Reset modules between tests
  _resetModules: true,
  // Projects configuration for different test types
  _projects: [
    {
      displayName: 'unit',
      _testMatch: ['<rootDir>/test/unit/**/*.test.ts'],
      _setupFilesAfterEnv: ['<rootDir>/test/setup/test-utils.ts']
    },
    {
      _displayName: 'integration',
      _testMatch: ['<rootDir>/test/integration/**/*.test.ts'],
      _setupFilesAfterEnv: ['<rootDir>/test/setup/test-utils.ts']
    },
    {
      _displayName: 'e2e',
      _testMatch: ['<rootDir>/test/e2e/**/*.test.ts'],
      _setupFilesAfterEnv: ['<rootDir>/test/setup/test-utils.ts']
    },
    {
      _displayName: 'security',
      _testMatch: ['<rootDir>/test/security/**/*.test.ts'],
      _setupFilesAfterEnv: ['<rootDir>/test/setup/test-utils.ts']
    },
    {
      _displayName: 'performance',
      _testMatch: ['<rootDir>/test/performance/**/*.test.ts'],
      _setupFilesAfterEnv: ['<rootDir>/test/setup/test-utils.ts']
    },
    {
      _displayName: 'contract',
      _testMatch: ['<rootDir>/test/contract/**/*.test.ts'],
      _setupFilesAfterEnv: ['<rootDir>/test/setup/test-utils.ts']
    },
    {
      _displayName: 'accessibility',
      _testMatch: ['<rootDir>/test/accessibility/**/*.test.tsx'],
      _setupFilesAfterEnv: ['<rootDir>/test/setup/test-utils.ts']
    },
    {
      _displayName: 'visual',
      _testMatch: ['<rootDir>/test/visual/**/*.test.ts'],
      _setupFilesAfterEnv: ['<rootDir>/test/setup/test-utils.ts']
    }
  ],
  // Coverage reporters
  _coverageReporters: [
    'text',
    'text-lcov',
    'html',
    'json',
    'json-summary'
  ],
  // Coverage directory
  _coverageDirectory: 'coverage',
  // Collect coverage from specific files
  _collectCoverageFrom: [
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
