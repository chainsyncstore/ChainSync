// Comprehensive test utilities for React 19 compatibility
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, expect } from 'vitest';

type ReactElement = any;

// Test providers wrapper
interface TestProvidersProps {
  children: React.ReactNode;
  queryClient?: QueryClient | undefined;
}

const TestProviders = ({ children, queryClient }: TestProvidersProps) => {
  const defaultQueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient ?? defaultQueryClient}>
      {children || undefined}
    </QueryClientProvider>
  );
};

// Custom render function with providers
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & {
    queryClient?: QueryClient;
  }
) => {
  const { queryClient, ...renderOptions } = options || {};
  
  return render(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <TestProviders queryClient={queryClient ?? undefined}>
        {children}
      </TestProviders>
    ),
    ...renderOptions,
  });
};

// Mock data factories with proper typing
export interface MockUser {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'cashier';
  storeId?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MockProduct {
  id: number;
  name: string;
  sku: string;
  price: string;
  description?: string;
  categoryId: number;
  storeId: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MockTransaction {
  id: number;
  userId: number;
  storeId: number;
  total: string;
  status: 'pending' | 'completed' | 'cancelled' | 'refunded';
  paymentMethod: 'cash' | 'card' | 'mobile';
  createdAt: string;
  updatedAt: string;
}

export interface MockInventory {
  id: number;
  productId: number;
  storeId: number;
  quantity: number;
  availableQuantity: number;
  minStock: number;
  updatedAt: string;
}

export interface MockCategory {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Factory functions with proper typing
export const createMockUser = (overrides: Partial<MockUser> = {}): MockUser => ({
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

export const createMockProduct = (overrides: Partial<MockProduct> = {}): MockProduct => ({
  id: 1,
  name: 'Test Product',
  sku: 'TEST-001',
  price: '10.99',
  description: 'Test product description',
  categoryId: 1,
  storeId: 1,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const createMockTransaction = (overrides: Partial<MockTransaction> = {}): MockTransaction => ({
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

export const createMockInventory = (overrides: Partial<MockInventory> = {}): MockInventory => ({
  id: 1,
  productId: 1,
  storeId: 1,
  quantity: 100,
  availableQuantity: 95,
  minStock: 10,
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const createMockCategory = (overrides: Partial<MockCategory> = {}): MockCategory => ({
  id: 1,
  name: 'Test Category',
  description: 'Test category description',
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

// API mock utilities
export const createApiMock = (data: any, delay = 0) => {
  return vi.fn().mockImplementation(() => 
    new Promise((resolve) => {
      setTimeout(() => resolve({ data }), delay);
    })
  );
};

export const createApiErrorMock = (error: any, delay = 0) => {
  return vi.fn().mockImplementation(() => 
    new Promise((_, reject) => {
      setTimeout(() => reject(error), delay);
    })
  );
};

// Async utilities for testing
export const waitFor = (condition: () => boolean, timeout = 5000): Promise<void> => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const checkCondition = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - startTime > timeout) {
        reject(new Error('Condition not met within timeout'));
      } else {
        setTimeout(checkCondition, 10);
      }
    };
    
    checkCondition();
  });
};

export const waitForElementToBeRemoved = (element: Element | null): Promise<void> => {
  return new Promise((resolve) => {
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

// Form testing utilities
export const fillFormField = async (element: HTMLElement, value: string) => {
  const input = element as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
};

export const submitForm = async (form: HTMLFormElement) => {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
};

// Custom matchers
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

  toBeValidDate(received: any) {
    const pass = received instanceof Date && !isNaN(received.getTime());
    return {
      pass,
      message: () => `expected ${received} to be a valid Date`,
    };
  },

  toBeValidEmail(received: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = emailRegex.test(received);
    return {
      pass,
      message: () => `expected ${received} to be a valid email address`,
    };
  },
});

// Type declarations for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveBeenCalledWithMatch(...expected: any[]): R;
      toBeValidDate(): R;
      toBeValidEmail(): R;
    }
  }
}

// Database testing utilities
export const createTestDatabase = async () => {
  // Mock database connection for testing
  return {
    query: {
      users: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
      },
      products: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
      },
      transactions: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
      },
      inventory: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
      },
      categories: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
      },
    },
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
};

// Authentication testing utilities
export const createMockAuth = (user?: MockUser) => {
  return {
    user: user || createMockUser(),
    isAuthenticated: !!user,
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
  };
};

// Store testing utilities
export const createMockStore = () => {
  return {
    dispatch: vi.fn(),
    getState: vi.fn(),
    subscribe: vi.fn(),
  };
};

// Export everything
export * from '@testing-library/react';
export { customRender as render };
export { vi, expect }; 