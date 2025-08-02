/**
 * Transaction Service Tests
 *
 * This file contains tests for the refactored transaction service, focusing on
 * validation, error handling, and schema standardization.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TransactionService } from './service';
import {
  TransactionServiceErrors,
  TransactionType,
  TransactionStatus,
  PaymentMethod
} from './types';
import { db } from '@db';
import * as schema from '@shared/schema';
import { SchemaValidationError } from '@shared/schema-validation';
import { InventoryService } from '../inventory/service';
import { LoyaltyService } from '../loyalty/service';

// Mock dependencies
jest.mock('../inventory/service');
jest.mock('../loyalty/service');

// Mock DB and schema validation
jest.mock('@db', () => ({
  _query: {
    transactions: {
      _findFirst: jest.fn(),
      _findMany: jest.fn()
    },
    _products: {
      _findFirst: jest.fn(),
      _findMany: jest.fn()
    },
    _stores: {
      _findFirst: jest.fn()
    },
    _users: {
      _findFirst: jest.fn()
    },
    _customers: {
      _findFirst: jest.fn()
    },
    _loyaltyMembers: {
      _findFirst: jest.fn()
    },
    _returns: {
      _findFirst: jest.fn()
    }
  },
  _insert: jest.fn().mockReturnThis(),
  _update: jest.fn().mockReturnThis(),
  _delete: jest.fn().mockReturnThis(),
  _select: jest.fn().mockReturnThis(),
  _from: jest.fn().mockReturnThis(),
  _where: jest.fn().mockReturnThis(),
  _groupBy: jest.fn().mockReturnThis(),
  _orderBy: jest.fn().mockReturnThis(),
  _limit: jest.fn().mockReturnThis(),
  _offset: jest.fn().mockReturnThis(),
  _leftJoin: jest.fn().mockReturnThis(),
  _returning: jest.fn(),
  _transaction: jest.fn().mockImplementation(async(fn) => await fn(db)),
  _set: jest.fn().mockReturnThis(),
  _values: jest.fn().mockReturnThis()
}));

jest.mock('@shared/schema-validation', () => ({
  _transactionValidation: {
    _insert: jest.fn(data => data),
    _update: jest.fn(data => data),
    _item: {
      _insert: jest.fn(data => data)
    },
    _payment: {
      _insert: jest.fn(data => data)
    },
    _refund: {
      _insert: jest.fn(data => data)
    },
    _refundItem: {
      _insert: jest.fn(data => data)
    }
  },
  _SchemaValidationError: class SchemaValidationError extends Error {
    constructor(_message: string, options?: Record<string, unknown>) {
      super(message);
      this.name = 'SchemaValidationError';
    }
    toJSON() {
      return {
        _error: this.name,
        _message: this.message
      };
    }
  }
}));

describe('TransactionService', () => {
  let _transactionService: TransactionService;
  let _mockInventoryService: jest.Mocked<InventoryService>;
  let _mockLoyaltyService: jest.Mocked<LoyaltyService>;
  type MockedDB = typeof db & {
    query: {
      transactions: {
        _findFirst: jest.Mock;
        _findMany: jest.Mock;
      };
      products: {
        _findFirst: jest.Mock;
        _findMany: jest.Mock;
      };
      stores: {
        _findFirst: jest.Mock;
      };
      users: {
        _findFirst: jest.Mock;
      };
      customers: {
        _findFirst: jest.Mock;
      };
      loyaltyMembers: {
        _findFirst: jest.Mock;
      };
      returns: {
        _findFirst: jest.Mock;
      };
    };
    _insert: jest.Mock;
    _update: jest.Mock;
    _delete: jest.Mock;
    _select: jest.Mock;
    _from: jest.Mock;
    _where: jest.Mock;
    _groupBy: jest.Mock;
    _orderBy: jest.Mock;
    _limit: jest.Mock;
    _offset: jest.Mock;
    _leftJoin: jest.Mock;
    _returning: jest.Mock;
    _transaction: jest.Mock;
    _set: jest.Mock;
    _values: jest.Mock;
  };
  const dbMock = db as MockedDB;
  beforeEach(() => {
    jest.clearAllMocks();

    // Set up mocked inventory service
    mockInventoryService = new InventoryService() as jest.Mocked<InventoryService>;
    // Type-_safe: adjustInventory expects (_params: InventoryAdjustmentParams) => Promise<boolean>
    jest.spyOn(mockInventoryService, 'adjustInventory').mockImplementation().mockResolvedValue(true);

    // Set up mocked loyalty service
    mockLoyaltyService = new LoyaltyService() as jest.Mocked<LoyaltyService>;
    // Type-_safe: awardPoints expects (_params: any) => Promise<boolean>
    jest.spyOn(mockLoyaltyService, 'awardPoints').mockImplementation().mockResolvedValue(true);

    // Apply mocks to TransactionService constructor
    (TransactionService.prototype as any).inventoryService = mockInventoryService;
    (TransactionService.prototype as any).loyaltyService = mockLoyaltyService;

    transactionService = new TransactionService();
  });

  describe('createTransaction', () => {
    const validTransactionData = {
      _storeId: 1,
      _customerId: 1,
      _userId: 1,
      _type: TransactionType.SALE,
      _subtotal: '100.00',
      _tax: '10.00',
      _total: '110.00',
      _paymentMethod: PaymentMethod.CASH,
      _notes: 'Test transaction',
      _reference: 'TXN-123',
      _items: [
        {
          _productId: 1,
          _quantity: 2,
          _unitPrice: '50.00'
        }
      ]
    };

    it('should create a transaction with validated data', async() => {
      // Mock dependencies
      dbMock.query.stores.findFirst.mockResolvedValue({ _id: 1, _name: 'Test Store' });
      dbMock.query.users.findFirst.mockResolvedValue({ _id: 1, _name: 'Test User' });
      dbMock.query.customers.findFirst.mockResolvedValue({ _id: 1, _name: 'Test Customer' });

      // Mock product with inventory
      dbMock.query.products.findMany.mockResolvedValue([{
        _id: 1,
        _name: 'Test Product',
        _inventory: [{ _availableQuantity: 10 }]
      }]);

      // Mock transaction insert
      dbMock.insert().values().returning.mockResolvedValueOnce([{ _id: 1, ...validTransactionData }]);

      const result = await transactionService.createTransaction(validTransactionData);

      // Check that validation was called
      expect(require('@shared/schema-validation').transactionValidation.insert).toHaveBeenCalled();

      // Check result has expected values
      expect(result).toEqual(expect.objectContaining({
        _id: 1,
        _storeId: validTransactionData.storeId,
        _type: validTransactionData.type
      }));

      // Check inventory was adjusted
      expect(mockInventoryService.adjustInventory).toHaveBeenCalledWith(expect.objectContaining({
        _productId: 1,
        _quantity: -2
      }));
    });

    it('should throw error when store does not exist', async() => {
      // Mock store not found
      const storesFindFirstMock = dbMock.query.stores.findFirst as jest.Mock<Promise<schema.Store | null>, [any?]>;
      storesFindFirstMock.mockResolvedValue(null);

      await expect(transactionService.createTransaction(validTransactionData))
        .rejects.toThrow(TransactionServiceErrors.STORE_NOT_FOUND.message);
    });

    it('should throw error when user does not exist', async() => {
      // Mock store exists but user doesn't
      dbMock.query.stores.findFirst.mockResolvedValue({ _id: 1, _name: 'Test Store' } as schema.Store);
      const usersFindFirstMock = dbMock.query.users.findFirst as jest.Mock<Promise<schema.User | null>, [any?]>;
      usersFindFirstMock.mockResolvedValue(null);

      await expect(transactionService.createTransaction(validTransactionData))
        .rejects.toThrow(TransactionServiceErrors.USER_NOT_FOUND.message);
    });

    it('should throw error when customer does not exist', async() => {
      // Mock store and user exist but customer doesn't
      dbMock.query.stores.findFirst.mockResolvedValue({ _id: 1, _name: 'Test Store' } as schema.Store);
      dbMock.query.users.findFirst.mockResolvedValue({ _id: 1, _name: 'Test User' } as schema.User);
      const customersFindFirstMock = dbMock.query.customers.findFirst as jest.Mock<Promise<schema.Customer | null>, [any?]>;
      customersFindFirstMock.mockResolvedValue(null);

      await expect(transactionService.createTransaction(validTransactionData))
        .rejects.toThrow(TransactionServiceErrors.CUSTOMER_NOT_FOUND.message);
    });

    it('should throw error when product not found', async() => {
      // Mock dependencies exist
      dbMock.query.stores.findFirst.mockResolvedValue({ _id: 1, _name: 'Test Store' });
      dbMock.query.users.findFirst.mockResolvedValue({ _id: 1, _name: 'Test User' });
      dbMock.query.customers.findFirst.mockResolvedValue({ _id: 1, _name: 'Test Customer' });

      // Mock product not found (empty array)
      dbMock.query.products.findMany.mockResolvedValue([]);

      await expect(transactionService.createTransaction(validTransactionData))
        .rejects.toThrow(TransactionServiceErrors.PRODUCT_NOT_FOUND.message);
    });

    it('should throw error when insufficient stock', async() => {
      // Mock dependencies exist
      dbMock.query.stores.findFirst.mockResolvedValue({ _id: 1, _name: 'Test Store' });
      dbMock.query.users.findFirst.mockResolvedValue({ _id: 1, _name: 'Test User' });
      dbMock.query.customers.findFirst.mockResolvedValue({ _id: 1, _name: 'Test Customer' });

      // Mock product with insufficient inventory
      const productsFindManyMock = dbMock.query.products.findMany as jest.Mock<Promise<Array<{ _id: number; _name: string; _inventory: Array<{ _availableQuantity: number }> }>>, [any?]>;
productsFindManyMock.mockResolvedValue([
        {
          _id: 1,
          _name: 'Test Product',
          _inventory: [{ _availableQuantity: 1 }]
        }
      ]);

      await expect(transactionService.createTransaction(validTransactionData))
        .rejects.toThrow(TransactionServiceErrors.INSUFFICIENT_STOCK.message);
    });

    it('should handle validation errors properly', async() => {
      // Mock dependencies exist
      dbMock.query.stores.findFirst.mockResolvedValue({ _id: 1, _name: 'Test Store' });
      dbMock.query.users.findFirst.mockResolvedValue({ _id: 1, _name: 'Test User' });
      dbMock.query.customers.findFirst.mockResolvedValue({ _id: 1, _name: 'Test Customer' });
      dbMock.query.products.findMany.mockResolvedValue([{
        _id: 1,
        _name: 'Test Product',
        _inventory: [{ _availableQuantity: 10 }]
      }]);

      // Make validation throw an error
      (require('@shared/schema-validation').transactionValidation.insert as jest.Mock)
        .mockImplementationOnce(() => {
          throw new SchemaValidationError('Invalid transaction data');
        });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(transactionService.createTransaction(validTransactionData))
        .rejects.toThrow();

      // Check that error was logged
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('processRefund', () => {
    const validRefundParams = {
      _transactionId: 1,
      _reason: 'Customer dissatisfied',
      _userId: 1,
      _refundMethod: PaymentMethod.CASH,
      _fullRefund: true,
      _notes: 'Full refund processed'
    };

    const mockTransaction = {
      _id: 1,
      _storeId: 1,
      _subtotal: '100.00',
      _tax: '10.00',
      _total: '110.00',
      _status: TransactionStatus.COMPLETED,
      _items: [
        { _id: 1, _productId: 1, _quantity: 2, _unitPrice: '50.00' }
      ]
    };

    it('should process a full refund successfully', async() => {
      // Mock getTransactionById
      jest.spyOn(transactionService, 'getTransactionById').mockResolvedValue(mockTransaction as schema.Transaction);

      // Mock refund insert
      dbMock.insert().values().returning.mockResolvedValueOnce([{ _id: 1, _refundId: 'REF-123' }]);

      const result = await transactionService.processRefund(validRefundParams);

      // Check that validation was called
      expect(require('@shared/schema-validation').transactionValidation.refund.insert).toHaveBeenCalled();

      // Check result has expected values
      expect(result).toEqual(expect.objectContaining({
        _id: 1,
        _refundId: 'REF-123'
      }));

      // Check inventory was adjusted if items were restocked
      expect(mockInventoryService.adjustInventory).toHaveBeenCalled();

      // Check original transaction status was updated
      expect(db.update).toHaveBeenCalledWith(schema.transactions);
    });

    it('should throw error when transaction not found', async() => {
      // Mock transaction not found
      jest.spyOn(transactionService, 'getTransactionById').mockResolvedValue(null);

      await expect(transactionService.processRefund(validRefundParams))
        .rejects.toThrow(TransactionServiceErrors.TRANSACTION_NOT_FOUND.message);
    });

    it('should throw error when transaction already refunded', async() => {
      // Mock transaction already refunded
      jest.spyOn(transactionService, 'getTransactionById').mockResolvedValue({
        ...mockTransaction,
        _status: TransactionStatus.REFUNDED
      } as schema.Transaction);

      await expect(transactionService.processRefund(validRefundParams))
        .rejects.toThrow(TransactionServiceErrors.INVALID_REFUND.message);
    });

    it('should handle partial refunds', async() => {
      // Mock getTransactionById
      jest.spyOn(transactionService, 'getTransactionById').mockResolvedValue(mockTransaction as schema.Transaction);

      // Mock refund insert
      dbMock.insert().values().returning.mockResolvedValueOnce([{ _id: 1, _refundId: 'REF-123' }]);

      // Partial refund params
      const partialRefundParams = {
        ...validRefundParams,
        _fullRefund: false,
        _items: [
          { _transactionItemId: 1, _quantity: 1, _unitPrice: '50.00', _isRestocked: true }
        ]
      };

      const result = await transactionService.processRefund(partialRefundParams);

      // Check result has expected values
      expect(result).toEqual(expect.objectContaining({
        _id: 1,
        _refundId: 'REF-123'
      }));

      // Check original transaction status was updated to partially refunded
      expect(db.update).toHaveBeenCalledWith(schema.transactions);
      expect(db.set).toHaveBeenCalledWith(expect.objectContaining({
        _status: TransactionStatus.PARTIALLY_REFUNDED
      }));
    });
  });

  describe('getTransactionAnalytics', () => {
    it('should return analytics data for a store', async() => {
      // Mock store exists
      dbMock.query.stores.findFirst.mockResolvedValue({ _id: 1, _name: 'Test Store' });

      // Mock analytics queries
      (db.select().from().where as jest.Mock).mockReturnValueOnce({
        // Sales totals
        _totalSales: '1000.00',
        _totalRefunds: '100.00',
        _saleCount: 10,
        _refundCount: 2
      });

      // Mock payment method breakdown
      jest.spyOn(db, 'select').mockImplementation().mockReturnValue({
        _from: jest.fn().mockReturnValue({
          _where: jest.fn().mockReturnValue({
            _groupBy: jest.fn().mockReturnValue([
              { _method: PaymentMethod.CASH, _amount: '500.00', _count: 5 },
              { _method: PaymentMethod.CREDIT_CARD, _amount: '500.00', _count: 5 }
            ])
          })
        })
      });

      // Mock hour of day breakdown
      jest.spyOn(db, 'select').mockImplementation().mockReturnValue({
        _from: jest.fn().mockReturnValue({
          _where: jest.fn().mockReturnValue({
            _groupBy: jest.fn().mockReturnValue({
              _orderBy: jest.fn().mockReturnValue([
                { _hour: 9, _amount: '200.00', _count: 2 },
                { _hour: 10, _amount: '300.00', _count: 3 },
                { _hour: 11, _amount: '500.00', _count: 5 }
              ])
            })
          })
        })
      });

      // Mock day of week breakdown
      jest.spyOn(db, 'select').mockImplementation().mockReturnValue({
        _from: jest.fn().mockReturnValue({
          _where: jest.fn().mockReturnValue({
            _groupBy: jest.fn().mockReturnValue({
              _orderBy: jest.fn().mockReturnValue([
                { _day: 1, _amount: '200.00', _count: 2 },
                { _day: 2, _amount: '300.00', _count: 3 },
                { _day: 3, _amount: '500.00', _count: 5 }
              ])
            })
          })
        })
      });

      const result = await transactionService.getTransactionAnalytics(1);

      // Since we can't fully mock the complex query chains, we'll just check that the method
      // returns without error and has the expected structure
      expect(result).toHaveProperty('totalSales');
      expect(result).toHaveProperty('totalRefunds');
      expect(result).toHaveProperty('netSales');
      expect(result).toHaveProperty('averageTransactionValue');
      expect(result).toHaveProperty('transactionCount');
      expect(result).toHaveProperty('refundCount');
      expect(result).toHaveProperty('salesByPaymentMethod');
      expect(result).toHaveProperty('salesByHourOfDay');
      expect(result).toHaveProperty('salesByDayOfWeek');
    });

    it('should throw error when store not found', async() => {
      // Mock store not found
      const storesFindFirstMock = dbMock.query.stores.findFirst as jest.Mock<Promise<schema.Store | null>, [any?]>;
      storesFindFirstMock.mockResolvedValue(null);

      await expect(transactionService.getTransactionAnalytics(1))
        .rejects.toThrow(TransactionServiceErrors.STORE_NOT_FOUND.message);
    });
  });
});
