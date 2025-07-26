/**
 * Test Environment Setup
 * 
 * This file sets up the testing environment with mocked dependencies
 * and test-specific configuration to ensure tests can run without
 * external dependencies like databases.
 */

// Mock environment variables required for tests
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test_db';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.API_URL = 'http://localhost:3000';
process.env.CLIENT_URL = 'http://localhost:5173';

// Ensure Prisma mock is loaded so global prisma getter is defined
import '@prisma/client';

// Mock the database connection
jest.mock('../server/database', () => ({
  db: {
    execute: jest.fn().mockResolvedValue({ rows: [] }),
    query: {
      users: {
        findFirst: jest.fn(),
        findMany: jest.fn()
      },
      products: {
        findFirst: jest.fn(),
        findMany: jest.fn()
      },
      stores: {
        findFirst: jest.fn(),
        findMany: jest.fn()
      },
      inventory: {
        findFirst: jest.fn(),
        findMany: jest.fn()
      },
      inventoryBatches: {
        findFirst: jest.fn(),
        findMany: jest.fn()
      },
      subscriptions: {
        findFirst: jest.fn(),
        findMany: jest.fn()
      },
      loyalty: {
        findFirst: jest.fn(),
        findMany: jest.fn()
      },
      loyaltyMembers: {
        findFirst: jest.fn(),
        findMany: jest.fn()
      },
      loyaltyTransactions: {
        findFirst: jest.fn(),
        findMany: jest.fn()
      },
      transactions: {
        findFirst: jest.fn(),
        findMany: jest.fn()
      }
    },
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn()
      })
    }),
    update: jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn()
        })
      })
    }),
    delete: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        returning: jest.fn()
      })
    }),
    transaction: jest.fn()
  },
  sql: {
    raw: jest.fn(query => query)
  }
}));

// Mock schema validation
jest.mock('../shared/schema-validation', () => {
  const actual = jest.requireActual('../shared/schema-validation');
  return {
  userValidation: {
    insert: jest.fn().mockImplementation(data => data),
    update: jest.fn().mockImplementation(data => data)
  },
  productValidation: {
    insert: jest.fn().mockImplementation(data => data),
    update: jest.fn().mockImplementation(data => data)
  },
  storeValidation: {
    insert: jest.fn().mockImplementation(data => data),
    update: jest.fn().mockImplementation(data => data)
  },
  inventoryValidation: {
    insert: jest.fn().mockImplementation(data => data),
    update: jest.fn().mockImplementation(data => data)
  },
  subscriptionValidation: {
    insert: jest.fn().mockImplementation(data => data),
    update: jest.fn().mockImplementation(data => data)
  },
  loyaltyValidation: {
    insert: jest.fn().mockImplementation(data => data),
    update: jest.fn().mockImplementation(data => data)
  },
  transactionValidation: {
    insert: jest.fn().mockImplementation(data => data),
    update: jest.fn().mockImplementation(data => data)
  },
  SchemaValidationError: actual.SchemaValidationError,
 }; 
});

// Fix the ServiceError reference in the loyalty module
jest.mock('../server/services/loyalty/types', () => {
  const { AppError } = require('../shared/errors');
  const { ErrorCode } = require('../shared/types/errors');
  
  return {
    LoyaltyServiceErrors: {
      CUSTOMER_NOT_FOUND: new AppError(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Customer not found'
      ),
      PROGRAM_NOT_FOUND: new AppError(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Loyalty program not found'
      ),
      MEMBER_NOT_FOUND: new AppError(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Loyalty member not found'
      ),
      TRANSACTION_NOT_FOUND: new AppError(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Loyalty transaction not found'
      ),
      INVALID_POINTS: new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Invalid points value'
      )
    }
  };
});
