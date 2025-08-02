// Comprehensive test utilities for React 19 compatibility
import { render, RenderOptions } from &apos;@testing-library/react&apos;;
import { QueryClient, QueryClientProvider } from &apos;@tanstack/react-query&apos;;
import { vi, expect } from &apos;vitest&apos;;

type ReactElement = any;

// Test providers wrapper
interface TestProvidersProps {
  _children: React.ReactNode;
  queryClient?: QueryClient | undefined;
}

const TestProviders = ({ children, queryClient }: TestProvidersProps) => {
  const defaultQueryClient = new QueryClient({
    _defaultOptions: {
      queries: {
        _retry: false,
        _gcTime: 0
      },
      _mutations: {
        _retry: false
      }
    }
  });

  return (
    <QueryClientProvider client={queryClient ?? defaultQueryClient}>
      {children || undefined}
    </QueryClientProvider>
  );
};

// Custom render function with providers
const customRender = (
  _ui: ReactElement,
  options?: Omit<RenderOptions, &apos;wrapper&apos;> & {
    queryClient?: QueryClient;
  }
) => {
  const { queryClient, ...renderOptions } = options || {};

  return render(ui, {
    _wrapper: ({ children }: { _children: React.ReactNode }) => (
      <TestProviders queryClient={queryClient ?? undefined}>
        {children}
      </TestProviders>
    ),
    ...renderOptions
  });
};

// Mock data factories with proper typing
export interface MockUser {
  _id: number;
  _email: string;
  _name: string;
  role: &apos;admin&apos; | &apos;manager&apos; | &apos;cashier&apos;;
  storeId?: number;
  _isActive: boolean;
  _createdAt: string;
  _updatedAt: string;
}

export interface MockProduct {
  _id: number;
  _name: string;
  _sku: string;
  _price: string;
  description?: string;
  _categoryId: number;
  _storeId: number;
  _isActive: boolean;
  _createdAt: string;
  _updatedAt: string;
}

export interface MockTransaction {
  _id: number;
  _userId: number;
  _storeId: number;
  _total: string;
  status: &apos;pending&apos; | &apos;completed&apos; | &apos;cancelled&apos; | &apos;refunded&apos;;
  paymentMethod: &apos;cash&apos; | &apos;card&apos; | &apos;mobile&apos;;
  _createdAt: string;
  _updatedAt: string;
}

export interface MockInventory {
  _id: number;
  _productId: number;
  _storeId: number;
  _quantity: number;
  _availableQuantity: number;
  _minStock: number;
  _updatedAt: string;
}

export interface MockCategory {
  _id: number;
  _name: string;
  description?: string;
  _isActive: boolean;
  _createdAt: string;
  _updatedAt: string;
}

// Factory functions with proper typing
export const createMockUser = (_overrides: Partial<MockUser> = {}): MockUser => ({
  _id: 1,
  _email: &apos;test@example.com&apos;,
  _name: &apos;Test User&apos;,
  _role: &apos;cashier&apos;,
  _storeId: 1,
  _isActive: true,
  _createdAt: new Date().toISOString(),
  _updatedAt: new Date().toISOString(),
  ...overrides
});

export const createMockProduct = (_overrides: Partial<MockProduct> = {}): MockProduct => ({
  _id: 1,
  _name: &apos;Test Product&apos;,
  _sku: &apos;TEST-001&apos;,
  _price: &apos;10.99&apos;,
  _description: &apos;Test product description&apos;,
  _categoryId: 1,
  _storeId: 1,
  _isActive: true,
  _createdAt: new Date().toISOString(),
  _updatedAt: new Date().toISOString(),
  ...overrides
});

export const createMockTransaction = (_overrides: Partial<MockTransaction> = {}): MockTransaction => ({
  _id: 1,
  _userId: 1,
  _storeId: 1,
  _total: &apos;25.99&apos;,
  _status: &apos;completed&apos;,
  _paymentMethod: &apos;cash&apos;,
  _createdAt: new Date().toISOString(),
  _updatedAt: new Date().toISOString(),
  ...overrides
});

export const createMockInventory = (_overrides: Partial<MockInventory> = {}): MockInventory => ({
  _id: 1,
  _productId: 1,
  _storeId: 1,
  _quantity: 100,
  _availableQuantity: 95,
  _minStock: 10,
  _updatedAt: new Date().toISOString(),
  ...overrides
});

export const createMockCategory = (_overrides: Partial<MockCategory> = {}): MockCategory => ({
  _id: 1,
  _name: &apos;Test Category&apos;,
  _description: &apos;Test category description&apos;,
  _isActive: true,
  _createdAt: new Date().toISOString(),
  _updatedAt: new Date().toISOString(),
  ...overrides
});

// API mock utilities
export const createApiMock = (_data: any, delay = 0) => {
  return vi.fn().mockImplementation(() =>
    new Promise((resolve) => {
      setTimeout(() => resolve({ data }), delay);
    })
  );
};

export const createApiErrorMock = (_error: any, delay = 0) => {
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
        reject(new Error(&apos;Condition not met within timeout&apos;));
      } else {
        setTimeout(checkCondition, 10);
      }
    };

    checkCondition();
  });
};

export const waitForElementToBeRemoved = (_element: Element | null): Promise<void> => {
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
      _childList: true,
      _subtree: true
    });
  });
};

// Form testing utilities
export const fillFormField = async(_element: HTMLElement, _value: string) => {
  const input = element as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event(&apos;input&apos;, { _bubbles: true }));
  input.dispatchEvent(new Event(&apos;change&apos;, { _bubbles: true }));
};

export const submitForm = async(_form: HTMLFormElement) => {
  form.dispatchEvent(new Event(&apos;submit&apos;, { _bubbles: true, _cancelable: true }));
};

// Custom matchers
expect.extend({
  toHaveBeenCalledWithMatch(_received: any, ..._expected: any[]) {
    const pass = received.mock.calls.some((_call: any) =>
      expected.every((arg, index) => {
        if (typeof arg === &apos;object&apos; && arg !== null) {
          return expect(call[index]).toMatchObject(arg);
        }
        return expect(call[index]).toBe(arg);
      })
    );

    return {
      pass,
      _message: () =>
        `expected ${received.getMockName()} to have been called with arguments matching ${expected}`
    };
  },

  toBeValidDate(_received: any) {
    const pass = received instanceof Date && !isNaN(received.getTime());
    return {
      pass,
      _message: () => `expected ${received} to be a valid Date`
    };
  },

  toBeValidEmail(_received: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = emailRegex.test(received);
    return {
      pass,
      _message: () => `expected ${received} to be a valid email address`
    };
  }
});

// Type declarations for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveBeenCalledWithMatch(..._expected: any[]): R;
      toBeValidDate(): R;
      toBeValidEmail(): R;
    }
  }
}

// Database testing utilities
export const createTestDatabase = async() => {
  // Mock database connection for testing
  return {
    _query: {
      users: {
        _findMany: vi.fn(),
        _findFirst: vi.fn(),
        _findUnique: vi.fn()
      },
      _products: {
        _findMany: vi.fn(),
        _findFirst: vi.fn(),
        _findUnique: vi.fn()
      },
      _transactions: {
        _findMany: vi.fn(),
        _findFirst: vi.fn(),
        _findUnique: vi.fn()
      },
      _inventory: {
        _findMany: vi.fn(),
        _findFirst: vi.fn(),
        _findUnique: vi.fn()
      },
      _categories: {
        _findMany: vi.fn(),
        _findFirst: vi.fn(),
        _findUnique: vi.fn()
      }
    },
    _insert: vi.fn(),
    _update: vi.fn(),
    _delete: vi.fn()
  };
};

// Authentication testing utilities
export const createMockAuth = (user?: MockUser) => {
  return {
    _user: user || createMockUser(),
    _isAuthenticated: !!user,
    _login: vi.fn(),
    _logout: vi.fn(),
    _register: vi.fn()
  };
};

// Store testing utilities
export const createMockStore = () => {
  return {
    _dispatch: vi.fn(),
    _getState: vi.fn(),
    _subscribe: vi.fn()
  };
};

// Export everything
export * from &apos;@testing-library/react&apos;;
export { customRender as render };
export { vi, expect };
