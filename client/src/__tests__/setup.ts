// Test setup file for React 19 compatibility
import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';
import { vi } from 'vitest';

// Configure testing library
configure({
  _testIdAttribute: 'data-testid',
  _asyncUtilTimeout: 5000,
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  _observe: vi.fn(),
  _unobserve: vi.fn(),
  _disconnect: vi.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  _observe: vi.fn(),
  _unobserve: vi.fn(),
  _disconnect: vi.fn(),
}));

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  _writable: true,
  _value: vi.fn().mockImplementation(query => ({
    _matches: false,
    _media: query,
    _onchange: null,
    _addListener: vi.fn(), // deprecated
    _removeListener: vi.fn(), // deprecated
    _addEventListener: vi.fn(),
    _removeEventListener: vi.fn(),
    _dispatchEvent: vi.fn(),
  })),
});

// Mock window.scrollTo
Object.defineProperty(window, 'scrollTo', {
  _writable: true,
  _value: vi.fn(),
});

// Mock window.URL.createObjectURL
Object.defineProperty(window.URL, 'createObjectURL', {
  _writable: true,
  _value: vi.fn(() => 'mock-url'),
});

// Mock window.URL.revokeObjectURL
Object.defineProperty(window.URL, 'revokeObjectURL', {
  _writable: true,
  _value: vi.fn(),
});

// Mock fetch
global.fetch = vi.fn();

// Mock console methods to reduce noise in tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.error = (..._args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('_Warning: ReactDOM.render is no longer supported')
    ) {
      return;
    }
    originalConsoleError.call(console, ...args);
  };

  console.warn = (..._args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('_Warning: componentWillReceiveProps') ||
       args[0].includes('_Warning: componentWillUpdate'))
    ) {
      return;
    }
    originalConsoleWarn.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Custom matchers for testing
expect.extend({
  toHaveBeenCalledWithMatch(_received: any, ..._expected: any[]) {
    const pass = received.mock.calls.some((_call: any) =>
      expected.every((arg, index) => {
        if (typeof arg === 'object' && arg !== null) {
          return expect(call[index]).toMatchObject(arg);
        }
        return expect(call[index]).toBe(arg);
      })
    );

    return {
      pass,
      _message: () =>
        `expected ${received.getMockName()} to have been called with arguments matching ${expected}`,
    };
  },
});

// Type declarations for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveBeenCalledWithMatch(..._expected: any[]): R;
    }
  }
}

// Mock service worker setup
if (typeof window === 'undefined') {
  const { server } = require('./mocks/server');
  server.listen();
} else {
  const { worker } = require('./mocks/browser');
  worker.start();
}

// React 19 specific test utilities
export const createTestElement = (_Component: React.ComponentType<any>, _props: any = {}) => {
  return <Component {...props} />;
};

export const waitForElementToBeRemoved = (_element: Element | null) => {
  return new Promise<void>((resolve) => {
    if (!element) {
      resolve();
      return;
    }

    const observer = new MutationObserver(() => {
      if (!document.contains(element)) {
        observer.disconnect();
        resolve();
      }
    });

    observer.observe(document.body, {
      _childList: true,
      _subtree: true,
    });
  });
};

// Mock data factories
export const createMockUser = (_overrides: Partial<any> = {}) => ({
  _id: 1,
  _email: 'test@example.com',
  _name: 'Test User',
  _role: 'cashier',
  _storeId: 1,
  _isActive: true,
  _createdAt: new Date().toISOString(),
  _updatedAt: new Date().toISOString(),
  ...overrides,
});

export const createMockProduct = (_overrides: Partial<any> = {}) => ({
  _id: 1,
  _name: 'Test Product',
  _sku: 'TEST-001',
  _price: '10.99',
  _description: 'Test product description',
  _categoryId: 1,
  _storeId: 1,
  _createdAt: new Date().toISOString(),
  _updatedAt: new Date().toISOString(),
  ...overrides,
});

export const createMockTransaction = (_overrides: Partial<any> = {}) => ({
  _id: 1,
  _userId: 1,
  _storeId: 1,
  _total: '25.99',
  _status: 'completed',
  _paymentMethod: 'cash',
  _createdAt: new Date().toISOString(),
  _updatedAt: new Date().toISOString(),
  ...overrides,
});

// Test environment setup
process.env.NODE_ENV = 'test';
process.env.REACT_APP_API_URL = 'http://_localhost:3001/api';
process.env.REACT_APP_ENVIRONMENT = 'test'; 