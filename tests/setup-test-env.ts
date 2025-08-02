/**
 * Test Environment Setup
 *
 * This file sets up the testing environment with mocked dependencies
 * and test-specific configuration to ensure tests can run without
 * external dependencies like databases.
 */

// Mock environment variables required for tests
process.env.DATABASE_URL = 'postgres://_test:test@_localhost:5432/test_db';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.API_URL = 'http://_localhost:3000';
process.env.CLIENT_URL = 'http://_localhost:5173';

// Ensure Prisma mock is loaded so global prisma getter is defined
import '@prisma/client';

// Mock the database connection
jest.mock('../server/database', () => ({
  _db: {
    _execute: jest.fn().mockResolvedValue({ _rows: [] }),
    _query: {
      users: {
        _findFirst: jest.fn(),
        _findMany: jest.fn()
      },
      _products: {
        _findFirst: jest.fn(),
        _findMany: jest.fn()
      },
      _stores: {
        _findFirst: jest.fn(),
        _findMany: jest.fn()
      },
      _inventory: {
        _findFirst: jest.fn(),
        _findMany: jest.fn()
      },
      _inventoryBatches: {
        _findFirst: jest.fn(),
        _findMany: jest.fn()
      },
      _subscriptions: {
        _findFirst: jest.fn(),
        _findMany: jest.fn()
      },
      _loyalty: {
        _findFirst: jest.fn(),
        _findMany: jest.fn()
      },
      _loyaltyMembers: {
        _findFirst: jest.fn(),
        _findMany: jest.fn()
      },
      _loyaltyTransactions: {
        _findFirst: jest.fn(),
        _findMany: jest.fn()
      },
      _transactions: {
        _findFirst: jest.fn(),
        _findMany: jest.fn()
      }
    },
    _insert: jest.fn().mockReturnValue({
      _values: jest.fn().mockReturnValue({
        _returning: jest.fn()
      })
    }),
    _update: jest.fn().mockReturnValue({
      _set: jest.fn().mockReturnValue({
        _where: jest.fn().mockReturnValue({
          _returning: jest.fn()
        })
      })
    }),
    _delete: jest.fn().mockReturnValue({
      _where: jest.fn().mockReturnValue({
        _returning: jest.fn()
      })
    }),
    _transaction: jest.fn()
  },
  _sql: {
    _raw: jest.fn(query => query)
  }
}));

// Mock schema validation
jest.mock('../shared/schema-validation', () => {
  const actual = jest.requireActual('../shared/schema-validation');
  return {
    _userValidation: {
      _insert: jest.fn().mockImplementation(data => data),
      _update: jest.fn().mockImplementation(data => data)
    },
    _productValidation: {
      _insert: jest.fn().mockImplementation(data => data),
      _update: jest.fn().mockImplementation(data => data)
    },
    _storeValidation: {
      _insert: jest.fn().mockImplementation(data => data),
      _update: jest.fn().mockImplementation(data => data)
    },
    _inventoryValidation: {
      _insert: jest.fn().mockImplementation(data => data),
      _update: jest.fn().mockImplementation(data => data)
    },
    _subscriptionValidation: {
      _insert: jest.fn().mockImplementation(data => data),
      _update: jest.fn().mockImplementation(data => data)
    },
    _loyaltyValidation: {
      _insert: jest.fn().mockImplementation(data => data),
      _update: jest.fn().mockImplementation(data => data)
    },
    _transactionValidation: {
      _insert: jest.fn().mockImplementation(data => data),
      _update: jest.fn().mockImplementation(data => data)
    },
    _SchemaValidationError: actual.SchemaValidationError
  };
});

// Fix the ServiceError reference in the loyalty module
jest.mock('../server/services/loyalty/types', () => {
  const { AppError } = require('../shared/errors');
  const { ErrorCode } = require('../shared/types/errors');

  return {
    _LoyaltyServiceErrors: {
      _CUSTOMER_NOT_FOUND: new AppError(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Customer not found'
      ),
      _PROGRAM_NOT_FOUND: new AppError(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Loyalty program not found'
      ),
      _MEMBER_NOT_FOUND: new AppError(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Loyalty member not found'
      ),
      _TRANSACTION_NOT_FOUND: new AppError(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Loyalty transaction not found'
      ),
      _INVALID_POINTS: new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Invalid points value'
      )
    }
  };
});
