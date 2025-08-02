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
  query: {
    transactions: {
      findFirst: jest.fn(),
      findMany: jest.fn()
    },
    products: {
      findFirst: jest.fn(),
      findMany: jest.fn()
    },
    stores: {
      findFirst: jest.fn()
    },
    users: {
      findFirst: jest.fn()
    },
    customers: {
      findFirst: jest.fn()
    },
    loyaltyMembers: {
      findFirst: jest.fn()
    },
    returns: {
      findFirst: jest.fn()
    }
  },
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  offset: jest.fn().mockReturnThis(),
  leftJoin: jest.fn().mockReturnThis(),
  returning: jest.fn(),
  transaction: jest.fn().mockImplementation(async(fn) => await fn(db)),
  set: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis()
}));

jest.mock('@shared/schema-validation', () => ({
  transactionValidation: {
    insert: jest.fn(data => data),
    update: jest.fn(data => data),
    item: {
      insert: jest.fn(data => data)
    },
    payment: {
      insert: jest.fn(data => data)
    },
    refund: {
      insert: jest.fn(data => data)
    },
    refundItem: {
      insert: jest.fn(data => data)
    }
  },
  SchemaValidationError: class SchemaValidationError extends Error {
    constructor(message: string, options?: Record<string, unknown>) {
      super(message);
      this.name = 'SchemaValidationError';
    }
    toJSON() {
      return {
        error: this.name,
        message: this.message
      };
    }
  }
}));

describe('TransactionService', () => {
  let transactionService: TransactionService;
  let mockInventoryService: jest.Mocked<InventoryService>;
  let mockLoyaltyService: jest.Mocked<LoyaltyService>;
  type MockedDB = typeof db & {
    query: {
      transactions: {
        findFirst: jest.Mock;
        findMany: jest.Mock;
      };
      products: {
        findFirst: jest.Mock;
        findMany: jest.Mock;
      };
      stores: {
        findFirst: jest.Mock;
      };
      users: {
        findFirst: jest.Mock;
      };
      customers: {
        findFirst: jest.Mock;
      };
      loyaltyMembers: {
        findFirst: jest.Mock;
      };
      returns: {
        findFirst: jest.Mock;
      };
    };
    insert: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    select: jest.Mock;
    from: jest.Mock;
    where: jest.Mock;
    groupBy: jest.Mock;
    orderBy: jest.Mock;
    limit: jest.Mock;
    offset: jest.Mock;
    leftJoin: jest.Mock;
    returning: jest.Mock;
    transaction: jest.Mock;
    set: jest.Mock;
    values: jest.Mock;
  };
  const dbMock = db as MockedDB;
  beforeEach(() => {
    jest.clearAllMocks();

    // Set up mocked inventory service
    mockInventoryService = new InventoryService() as jest.Mocked<InventoryService>;
    // Type-safe: adjustInventory expects (params: InventoryAdjustmentParams) => Promise<boolean>
    jest.spyOn(mockInventoryService, 'adjustInventory').mockImplementation().mockResolvedValue(true);

    // Set up mocked loyalty service
    mockLoyaltyService = new LoyaltyService() as jest.Mocked<LoyaltyService>;
    // Type-safe: awardPoints expects (params: any) => Promise<boolean>
    jest.spyOn(mockLoyaltyService, 'awardPoints').mockImplementation().mockResolvedValue(true);

    // Apply mocks to TransactionService constructor
    (TransactionService.prototype as any).inventoryService = mockInventoryService;
    (TransactionService.prototype as any).loyaltyService = mockLoyaltyService;

    transactionService = new TransactionService();
  });

  describe('createTransaction', () => {
    const validTransactionData = {
      storeId: 1,
      customerId: 1,
      userId: 1,
      type: TransactionType.SALE,
      subtotal: '100.00',
      tax: '10.00',
      total: '110.00',
      paymentMethod: PaymentMethod.CASH,
      notes: 'Test transaction',
      reference: 'TXN-123',
      items: [
        {
          productId: 1,
          quantity: 2,
          unitPrice: '50.00'
        }
      ]
    };

    it('should create a transaction with validated data', async() => {
      // Mock dependencies
      dbMock.query.stores.findFirst.mockResolvedValue({ id: 1, name: 'Test Store' });
      dbMock.query.users.findFirst.mockResolvedValue({ id: 1, name: 'Test User' });
      dbMock.query.customers.findFirst.mockResolvedValue({ id: 1, name: 'Test Customer' });

      // Mock product with inventory
      dbMock.query.products.findMany.mockResolvedValue([{
        id: 1,
        name: 'Test Product',
        inventory: [{ availableQuantity: 10 }]
      }]);

      // Mock transaction insert
      dbMock.insert().values().returning.mockResolvedValueOnce([{ id: 1, ...validTransactionData }]);

      const result = await transactionService.createTransaction(validTransactionData);

      // Check that validation was called
      expect(require('@shared/schema-validation').transactionValidation.insert).toHaveBeenCalled();

      // Check result has expected values
      expect(result).toEqual(expect.objectContaining({
        id: 1,
        storeId: validTransactionData.storeId,
        type: validTransactionData.type
      }));

      // Check inventory was adjusted
      expect(mockInventoryService.adjustInventory).toHaveBeenCalledWith(expect.objectContaining({
        productId: 1,
        quantity: -2
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
      dbMock.query.stores.findFirst.mockResolvedValue({ id: 1, name: 'Test Store' } as schema.Store);
      const usersFindFirstMock = dbMock.query.users.findFirst as jest.Mock<Promise<schema.User | null>, [any?]>;
      usersFindFirstMock.mockResolvedValue(null);

      await expect(transactionService.createTransaction(validTransactionData))
        .rejects.toThrow(TransactionServiceErrors.USER_NOT_FOUND.message);
    });

    it('should throw error when customer does not exist', async() => {
      // Mock store and user exist but customer doesn't
      dbMock.query.stores.findFirst.mockResolvedValue({ id: 1, name: 'Test Store' } as schema.Store);
      dbMock.query.users.findFirst.mockResolvedValue({ id: 1, name: 'Test User' } as schema.User);
      const customersFindFirstMock = dbMock.query.customers.findFirst as jest.Mock<Promise<schema.Customer | null>, [any?]>;
      customersFindFirstMock.mockResolvedValue(null);

      await expect(transactionService.createTransaction(validTransactionData))
        .rejects.toThrow(TransactionServiceErrors.CUSTOMER_NOT_FOUND.message);
    });

    it('should throw error when product not found', async() => {
      // Mock dependencies exist
      dbMock.query.stores.findFirst.mockResolvedValue({ id: 1, name: 'Test Store' });
      dbMock.query.users.findFirst.mockResolvedValue({ id: 1, name: 'Test User' });
      dbMock.query.customers.findFirst.mockResolvedValue({ id: 1, name: 'Test Customer' });

      // Mock product not found (empty array)
      dbMock.query.products.findMany.mockResolvedValue([]);

      await expect(transactionService.createTransaction(validTransactionData))
        .rejects.toThrow(TransactionServiceErrors.PRODUCT_NOT_FOUND.message);
    });

    it('should throw error when insufficient stock', async() => {
      // Mock dependencies exist
      dbMock.query.stores.findFirst.mockResolvedValue({ id: 1, name: 'Test Store' });
      dbMock.query.users.findFirst.mockResolvedValue({ id: 1, name: 'Test User' });
      dbMock.query.customers.findFirst.mockResolvedValue({ id: 1, name: 'Test Customer' });

      // Mock product with insufficient inventory
      const productsFindManyMock = dbMock.query.products.findMany as jest.Mock<Promise<Array<{ id: number; name: string; inventory: Array<{ availableQuantity: number }> }>>, [any?]>;
productsFindManyMock.mockResolvedValue([
        {
          id: 1,
          name: 'Test Product',
          inventory: [{ availableQuantity: 1 }]
        }
      ]);

      await expect(transactionService.createTransaction(validTransactionData))
        .rejects.toThrow(TransactionServiceErrors.INSUFFICIENT_STOCK.message);
    });

    it('should handle validation errors properly', async() => {
      // Mock dependencies exist
      dbMock.query.stores.findFirst.mockResolvedValue({ id: 1, name: 'Test Store' });
      dbMock.query.users.findFirst.mockResolvedValue({ id: 1, name: 'Test User' });
      dbMock.query.customers.findFirst.mockResolvedValue({ id: 1, name: 'Test Customer' });
      dbMock.query.products.findMany.mockResolvedValue([{
        id: 1,
        name: 'Test Product',
        inventory: [{ availableQuantity: 10 }]
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
      transactionId: 1,
      reason: 'Customer dissatisfied',
      userId: 1,
      refundMethod: PaymentMethod.CASH,
      fullRefund: true,
      notes: 'Full refund processed'
    };

    const mockTransaction = {
      id: 1,
      storeId: 1,
      subtotal: '100.00',
      tax: '10.00',
      total: '110.00',
      status: TransactionStatus.COMPLETED,
      items: [
        { id: 1, productId: 1, quantity: 2, unitPrice: '50.00' }
      ]
    };

    it('should process a full refund successfully', async() => {
      // Mock getTransactionById
      jest.spyOn(transactionService, 'getTransactionById').mockResolvedValue(mockTransaction as schema.Transaction);

      // Mock refund insert
      dbMock.insert().values().returning.mockResolvedValueOnce([{ id: 1, refundId: 'REF-123' }]);

      const result = await transactionService.processRefund(validRefundParams);

      // Check that validation was called
      expect(require('@shared/schema-validation').transactionValidation.refund.insert).toHaveBeenCalled();

      // Check result has expected values
      expect(result).toEqual(expect.objectContaining({
        id: 1,
        refundId: 'REF-123'
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
        status: TransactionStatus.REFUNDED
      } as schema.Transaction);

      await expect(transactionService.processRefund(validRefundParams))
        .rejects.toThrow(TransactionServiceErrors.INVALID_REFUND.message);
    });

    it('should handle partial refunds', async() => {
      // Mock getTransactionById
      jest.spyOn(transactionService, 'getTransactionById').mockResolvedValue(mockTransaction as schema.Transaction);

      // Mock refund insert
      dbMock.insert().values().returning.mockResolvedValueOnce([{ id: 1, refundId: 'REF-123' }]);

      // Partial refund params
      const partialRefundParams = {
        ...validRefundParams,
        fullRefund: false,
        items: [
          { transactionItemId: 1, quantity: 1, unitPrice: '50.00', isRestocked: true }
        ]
      };

      const result = await transactionService.processRefund(partialRefundParams);

      // Check result has expected values
      expect(result).toEqual(expect.objectContaining({
        id: 1,
        refundId: 'REF-123'
      }));

      // Check original transaction status was updated to partially refunded
      expect(db.update).toHaveBeenCalledWith(schema.transactions);
      expect(db.set).toHaveBeenCalledWith(expect.objectContaining({
        status: TransactionStatus.PARTIALLY_REFUNDED
      }));
    });
  });

  describe('getTransactionAnalytics', () => {
    it('should return analytics data for a store', async() => {
      // Mock store exists
      dbMock.query.stores.findFirst.mockResolvedValue({ id: 1, name: 'Test Store' });

      // Mock analytics queries
      (db.select().from().where as jest.Mock).mockReturnValueOnce({
        // Sales totals
        totalSales: '1000.00',
        totalRefunds: '100.00',
        saleCount: 10,
        refundCount: 2
      });

      // Mock payment method breakdown
      jest.spyOn(db, 'select').mockImplementation().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            groupBy: jest.fn().mockReturnValue([
              { method: PaymentMethod.CASH, amount: '500.00', count: 5 },
              { method: PaymentMethod.CREDIT_CARD, amount: '500.00', count: 5 }
            ])
          })
        })
      });

      // Mock hour of day breakdown
      jest.spyOn(db, 'select').mockImplementation().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            groupBy: jest.fn().mockReturnValue({
              orderBy: jest.fn().mockReturnValue([
                { hour: 9, amount: '200.00', count: 2 },
                { hour: 10, amount: '300.00', count: 3 },
                { hour: 11, amount: '500.00', count: 5 }
              ])
            })
          })
        })
      });

      // Mock day of week breakdown
      jest.spyOn(db, 'select').mockImplementation().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            groupBy: jest.fn().mockReturnValue({
              orderBy: jest.fn().mockReturnValue([
                { day: 1, amount: '200.00', count: 2 },
                { day: 2, amount: '300.00', count: 3 },
                { day: 3, amount: '500.00', count: 5 }
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
