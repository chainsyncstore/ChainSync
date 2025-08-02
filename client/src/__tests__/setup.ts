// Test setup file for React 19 compatibility
import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';
import { vi } from 'vitest';

// Configure testing library
configure({
  testIdAttribute: 'data-testid',
  asyncUtilTimeout: 5000,
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock window.scrollTo
Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: vi.fn(),
});

// Mock window.URL.createObjectURL
Object.defineProperty(window.URL, 'createObjectURL', {
  writable: true,
  value: vi.fn(() => 'mock-url'),
});

// Mock window.URL.revokeObjectURL
Object.defineProperty(window.URL, 'revokeObjectURL', {
  writable: true,
  value: vi.fn(),
});

// Mock fetch
global.fetch = vi.fn();

// Mock console methods to reduce noise in tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return;
    }
    originalConsoleError.call(console, ...args);
  };

  console.warn = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: componentWillReceiveProps') ||
       args[0].includes('Warning: componentWillUpdate'))
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
  toHaveBeenCalledWithMatch(received: any, ...expected: any[]) {
    const pass = received.mock.calls.some((call: any) =>
      expected.every((arg, index) => {
        if (typeof arg === 'object' && arg !== null) {
          return expect(call[index]).toMatchObject(arg);
        }
        return expect(call[index]).toBe(arg);
      })
    );

    return {
      pass,
      message: () =>
        `expected ${received.getMockName()} to have been called with arguments matching ${expected}`,
    };
  },
});

// Type declarations for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveBeenCalledWithMatch(...expected: any[]): R;
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
export const createTestElement = (Component: React.ComponentType<any>, props: any = {}) => {
  return <Component {...props} />;
};

export const waitForElementToBeRemoved = (element: Element | null) => {
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
      childList: true,
      subtree: true,
    });
  });
};

// Mock data factories
export const createMockUser = (overrides: Partial<any> = {}) => ({
  id: 1,
  email: 'test@example.com',
  name: 'Test User',
  role: 'cashier',
  storeId: 1,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const createMockProduct = (overrides: Partial<any> = {}) => ({
  id: 1,
  name: 'Test Product',
  sku: 'TEST-001',
  price: '10.99',
  description: 'Test product description',
  categoryId: 1,
  storeId: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const createMockTransaction = (overrides: Partial<any> = {}) => ({
  id: 1,
  userId: 1,
  storeId: 1,
  total: '25.99',
  status: 'completed',
  paymentMethod: 'cash',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

// Test environment setup
process.env.NODE_ENV = 'test';
process.env.REACT_APP_API_URL = 'http://localhost:3001/api';
process.env.REACT_APP_ENVIRONMENT = 'test'; 