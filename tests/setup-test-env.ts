/**
 * Test Environment Setup
 *
 * This file sets up the testing environment with mocked dependencies
 * and test-specific configuration to ensure tests can run without
 * external dependencies like databases.
 */
import { jest } from '@jest/globals'; // Import Jest global

// Mock environment variables required for tests
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test_db';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.API_URL = 'http://localhost:3000';
process.env.CLIENT_URL = 'http://localhost:5173';

// Mock the database connection
jest.mock('../server/database', () => {
  const createTableQueryMocks = () => ({
    findFirst: jest.fn().mockImplementation((_args?: any) => ({
      execute: jest.fn().mockResolvedValue(undefined),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      // @ts-expect-error - Bypassing complex type inference for mock's thenable
      then: jest.fn(
        (
          onfulfilled?: ((value: any) => any | PromiseLike<any>) | null | undefined,
          onrejected?: ((reason: any) => any | PromiseLike<any>) | null | undefined
        ): Promise<any> => Promise.resolve(undefined).then(onfulfilled, onrejected)
      ),
    })),
    findMany: jest.fn().mockImplementation((_args?: any) => ({
      execute: jest.fn().mockResolvedValue([] as any[]),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      // @ts-expect-error - Bypassing complex type inference for mock's thenable
      then: jest.fn(
        (
          onfulfilled?: ((value: any[]) => any | PromiseLike<any[]>) | null | undefined,
          onrejected?: ((reason: any) => any | PromiseLike<any>) | null | undefined
        ): Promise<any> => Promise.resolve([]).then(onfulfilled, onrejected)
      ),
    })),
  });

  const createDrizzleBuilderMock = () => {
    const mockExecute = jest.fn<() => Promise<any[]>>().mockResolvedValue([]);
    const mockReturning = jest.fn<() => Promise<any[]>>().mockResolvedValue([]);
    const self = {
      values: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      returning: mockReturning,
      execute: mockExecute,
      then: jest.fn(
        (
          onfulfilled?: ((value: any[]) => any[] | PromiseLike<any[]>) | null | undefined,
          onrejected?: ((reason: any) => any | PromiseLike<any>) | null | undefined
        ) => Promise.resolve([]).then(onfulfilled, onrejected)
      ),
    };
    return self;
  };

  const createSelectBuilderMock = () => ({
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue([] as any[]),
    then: jest.fn(
      (
        onfulfilled?: (value: any[]) => any | PromiseLike<any>,
        onrejected?: (reason: any) => any | PromiseLike<any>
      ): Promise<any> => {
        return Promise.resolve([] as any[]).then(
          onfulfilled ? val => onfulfilled(val) : undefined,
          onrejected ? err => onrejected(err) : undefined
        );
      }
    ),
  });

  const dbMockData = {
    execute: jest.fn(async (): Promise<{ rows: any[] }> => ({ rows: [] })),
    batch: jest.fn(async () => []),
    session: {
      query: jest.fn(async () => ({ rows: [] })),
      execute: jest.fn(async () => ({ rows: [] })),
      client: {
        query: jest.fn(async (_query: string, _params?: any[]) => ({ rows: [] })),
      },
    },
    query: {
      users: createTableQueryMocks(),
      products: createTableQueryMocks(),
      stores: createTableQueryMocks(),
      inventory: createTableQueryMocks(),
      inventoryBatches: createTableQueryMocks(),
      subscriptions: createTableQueryMocks(),
      loyalty: createTableQueryMocks(),
      loyaltyMembers: createTableQueryMocks(),
      loyaltyTransactions: createTableQueryMocks(),
      transactions: createTableQueryMocks(),
    },
    insert: jest.fn().mockImplementation(createDrizzleBuilderMock),
    update: jest.fn().mockImplementation(createDrizzleBuilderMock),
    delete: jest.fn().mockImplementation(createDrizzleBuilderMock),
    select: jest.fn().mockImplementation(createSelectBuilderMock),
  };

  const dbMock = {
    ...dbMockData,
    transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => {
      const mockTx = {
        ...dbMockData,
        insert: jest.fn().mockImplementation(createDrizzleBuilderMock),
        update: jest.fn().mockImplementation(createDrizzleBuilderMock),
        delete: jest.fn().mockImplementation(createDrizzleBuilderMock),
        select: jest.fn().mockImplementation(createSelectBuilderMock),
        query: {
          users: createTableQueryMocks(),
          products: createTableQueryMocks(),
          stores: createTableQueryMocks(),
          inventory: createTableQueryMocks(),
          inventoryBatches: createTableQueryMocks(),
          subscriptions: createTableQueryMocks(),
          loyalty: createTableQueryMocks(),
          loyaltyMembers: createTableQueryMocks(),
          loyaltyTransactions: createTableQueryMocks(),
          transactions: createTableQueryMocks(),
        },
      };
      try {
        return await callback(mockTx);
      } catch (error) {
        throw error;
      }
    }),
  };

  return {
    db: dbMock,
    sql: {
      raw: jest.fn((query: any) => query),
    },
  };
});

// Mock drizzle-orm globally
const mockSqlObject = (strings: TemplateStringsArray, ...values: any[]) => ({
  _isMockSqlObject: true,
  strings,
  values,
  getSQL: () => strings.reduce((acc, str, i) => acc + str + (values[i] || ''), ''),
});
const mockSqlRaw = (query: string) => ({
  _isMockSqlRawObject: true,
  query,
  getSQL: () => query,
});

jest.mock('drizzle-orm', () => ({
  sql: Object.assign(mockSqlObject, { raw: mockSqlRaw }),
  eq: jest.fn((col, val) => ({ _isMockEq: true, col, val })),
}));

// Mock schema validation
jest.mock('../shared/schema-validation', () => ({
  userValidation: {
    insert: jest.fn().mockImplementation((data: any) => data),
    update: jest.fn().mockImplementation((data: any) => data),
  },
  productValidation: {
    insert: jest.fn().mockImplementation((data: any) => data),
    update: jest.fn().mockImplementation((data: any) => data),
  },
  storeValidation: {
    insert: jest.fn().mockImplementation((data: any) => data),
    update: jest.fn().mockImplementation((data: any) => data),
  },
  inventoryValidation: {
    insert: jest.fn().mockImplementation((data: any) => data),
    update: jest.fn().mockImplementation((data: any) => data),
  },
  subscriptionValidation: {
    insert: jest.fn().mockImplementation((data: any) => data),
    update: jest.fn().mockImplementation((data: any) => data),
  },
  loyaltyValidation: {
    insert: jest.fn().mockImplementation((data: any) => data),
    update: jest.fn().mockImplementation((data: any) => data),
  },
  transactionValidation: {
    insert: jest.fn().mockImplementation((data: any) => data),
    update: jest.fn().mockImplementation((data: any) => data),
  },
}));

// Local definitions to avoid problematic imports in setupFilesAfterEnv for ESM
class MockAppError extends Error {
  public type: string;
  public code: string;
  public statusCode: number;
  public details?: any;

  constructor(
    message: string,
    type: string,
    code: string,
    statusCode: number = 500,
    details?: any
  ) {
    super(message);
    this.name = 'MockAppError';
    this.type = type;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, MockAppError.prototype);
  }
}

const MockErrorCode = {
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
};

jest.mock('../server/services/loyalty/types', () => {
  return {
    LoyaltyServiceErrors: {
      CUSTOMER_NOT_FOUND: new MockAppError(
        'Customer not found',
        'RESOURCE',
        MockErrorCode.RESOURCE_NOT_FOUND,
        404
      ),
      PROGRAM_NOT_FOUND: new MockAppError(
        'Loyalty program not found',
        'RESOURCE',
        MockErrorCode.RESOURCE_NOT_FOUND,
        404
      ),
      MEMBER_NOT_FOUND: new MockAppError(
        'Loyalty member not found',
        'RESOURCE',
        MockErrorCode.RESOURCE_NOT_FOUND,
        404
      ),
      TRANSACTION_NOT_FOUND: new MockAppError(
        'Loyalty transaction not found',
        'RESOURCE',
        MockErrorCode.RESOURCE_NOT_FOUND,
        404
      ),
      INVALID_POINTS: new MockAppError(
        'Invalid points value',
        'VALIDATION',
        MockErrorCode.VALIDATION_ERROR,
        400
      ),
    },
  };
});
