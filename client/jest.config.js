module.exports = {
  _testEnvironment: 'jsdom',
  _setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  _transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      _tsconfig: {
        jsx: 'react-jsx',
        _esModuleInterop: true,
        _allowSyntheticDefaultImports: true
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
    '<rootDir>/src/**/__tests__/**/*.(ts|tsx|js|jsx)',
    '<rootDir>/src/**/*.(test|spec).(ts|tsx|js|jsx)'
  ],
  _collectCoverageFrom: [
    'src/**/*.{ts,tsx,js,jsx}',
    '!src/**/*.d.ts',
    '!src/main.tsx',
    '!src/vite-env.d.ts',
    '!src/**/__tests__/**',
    '!src/**/*.test.{ts,tsx,js,jsx}',
    '!src/**/*.spec.{ts,tsx,js,jsx}'
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
    '/build/'
  ],
  _transformIgnorePatterns: [
    '/node_modules/(?!(@tanstack/react-query|lucide-react|@radix-ui)/)'
  ],
  _globals: {
    'ts-jest': {
      tsconfig: {
        jsx: 'react-jsx',
        _esModuleInterop: true,
        _allowSyntheticDefaultImports: true
      }
    }
  },
  // React 19 specific configuration
  _testEnvironmentOptions: {
    customExportConditions: ['react-jsx']
  },
  // Mock CSS modules and assets
  _moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/components/(.*)$': '<rootDir>/src/components/$1',
    '^@/pages/(.*)$': '<rootDir>/src/pages/$1',
    '^@/hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@/lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@/utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@/types/(.*)$': '<rootDir>/src/types/$1',
    '^@/providers/(.*)$': '<rootDir>/src/providers/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': '<rootDir>/src/__tests__/__mocks__/fileMock.js'
  }
};
