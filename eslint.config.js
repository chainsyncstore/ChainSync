import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jest from 'eslint-plugin-jest';
import security from 'eslint-plugin-security';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        browser: 'readonly',
        node: 'readonly',
        jest: 'readonly',
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        exports: 'readonly',
        module: 'readonly',
        global: 'readonly',
        __dirname: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': typescript,
      'react': react,
      'react-hooks': reactHooks,
      'jest': jest,
      'security': security
    },
    rules: {
      // TypeScript rules
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-var-requires': 'error',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',

      // React rules
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/jsx-uses-react': 'off',
      'react/jsx-uses-vars': 'error',
      'react/jsx-key': 'error',
      'react/jsx-no-duplicate-props': 'error',
      'react/jsx-no-undef': 'error',
      'react/no-array-index-key': 'warn',
      'react/no-danger': 'error',
      'react/no-deprecated': 'error',
      'react/no-direct-mutation-state': 'error',
      'react/no-find-dom-node': 'error',
      'react/no-is-mounted': 'error',
      'react/no-render-return-value': 'error',
      'react/no-string-refs': 'error',
      'react/no-unescaped-entities': 'error',
      'react/no-unknown-property': 'error',
      'react/no-unsafe': 'error',
      'react/self-closing-comp': 'error',

      // React Hooks rules
      'react-hooks/rules-of-hooks': 'off', // Temporarily disabled due to compatibility issues
      'react-hooks/exhaustive-deps': 'off', // Temporarily disabled due to compatibility issues

      // Security rules
      'security/detect-object-injection': 'warn',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-unsafe-regex': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'warn',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-non-literal-require': 'warn',
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-pseudoRandomBytes': 'error',

      // General rules
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-alert': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-arrow-callback': 'error',
      'arrow-spacing': 'error',
      'no-duplicate-imports': 'error',
      'no-useless-constructor': 'error',
      'no-unused-expressions': 'error',
      'no-unreachable': 'error',
      'no-constant-condition': 'error',
      'no-empty': 'error',
      'no-extra-semi': 'error',
      'no-irregular-whitespace': 'error',
      'no-multiple-empty-lines': ['error', { max: 2 }],
      'no-trailing-spaces': 'error',
      'eol-last': 'error',
      'comma-dangle': ['error', 'never'],
      'semi': ['error', 'always'],
      'quotes': ['error', 'single', { avoidEscape: true }],
      'indent': 'off',
      'object-curly-spacing': ['error', 'always'],
      'array-bracket-spacing': ['error', 'never'],
      'comma-spacing': ['error', { before: false, after: true }],
      'key-spacing': ['error', { beforeColon: false, afterColon: true }],
      'keyword-spacing': ['error', { before: true, after: true }],
      'space-before-blocks': 'error',
      'space-before-function-paren': ['error', 'never'],
      'space-in-parens': ['error', 'never'],
      'space-infix-ops': 'error',
      'space-unary-ops': 'error',
      'spaced-comment': ['error', 'always'],
      'template-curly-spacing': ['error', 'never'],
      'yield-star-spacing': ['error', 'both'],
      'max-len': ['warn', { code: 100, ignoreUrls: true, ignoreStrings: true }],
      'complexity': ['warn', 10],
      'max-depth': ['warn', 4],
      'max-lines': ['warn', 300],
      'max-params': ['warn', 5],
      'max-statements': ['warn', 20],

      // Jest rules
      'jest/no-disabled-tests': 'warn',
      'jest/no-focused-tests': 'error',
      'jest/no-identical-title': 'error',
      'jest/prefer-to-have-length': 'warn',
      'jest/valid-expect': 'error',
      'jest/no-test-return-statement': 'error',
      'jest/prefer-expect-assertions': 'warn',
      'jest/expect-expect': 'warn',
      'jest/no-commented-out-tests': 'warn',
      'jest/no-duplicate-hooks': 'error',
      'jest/no-if': 'error',
      'jest/no-restricted-matchers': 'error',
      'jest/no-standalone-expect': 'error',
      'jest/no-test-prefixes': 'error',
      'jest/prefer-called-with': 'warn',
      'jest/prefer-hooks-on-top': 'error',
      'jest/prefer-spy-on': 'warn',
      'jest/prefer-strict-equal': 'warn',
      'jest/prefer-todo': 'warn',
      'jest/require-hook': 'error',
      'jest/require-to-throw-message': 'error',
      'jest/require-top-level-describe': 'error',
      'jest/valid-describe-callback': 'error',
      'jest/valid-expect-in-promise': 'error',
      'jest/valid-title': 'error'
    },
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  // TypeScript files configuration
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module'
      }
    }
  },
  // Test files configuration
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx', 'test/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module'
      }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'max-lines': 'off',
      'max-statements': 'off',
      'jest/require-hook': 'off',
      'jest/require-top-level-describe': 'off',
      'jest/no-standalone-expect': 'off'
    }
  },
  {
    files: ['**/server/**/*.ts', '**/server/**/*.js'],
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off'
    }
  },
  {
    files: ['**/client/**/*.tsx', '**/client/**/*.ts'],
    rules: {
      'security/detect-child-process': 'off',
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-non-literal-require': 'off'
    }
  },
  // Configuration files
  {
    files: ['*.config.js', '*.config.ts', 'vite.config.*', 'jest.config.*'],
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
      'no-undef': 'off'
    }
  },
  // Mock files
  {
    files: ['**/__mocks__/**/*.js', '**/__mocks__/**/*.ts'],
    rules: {
      'jest/require-hook': 'off',
      'no-undef': 'off',
      '@typescript-eslint/no-var-requires': 'off'
    }
  },
  {
    ignores: [
      'dist/',
      'dist.bak/',
      'build/',
      'coverage/',
      'node_modules/',
      '*.config.js',
      '*.config.ts',
      'migrations/',
      '**/*.d.ts',
      '**/*.js.map',
      '**/*.ts.map'
    ]
  }
];
