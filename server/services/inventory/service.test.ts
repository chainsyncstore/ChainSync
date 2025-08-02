/**
 * Inventory Service Tests
 *
 * This file contains tests for the refactored inventory service, focusing on
 * validation, error handling, and schema standardization.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'; // afterEach removed
import { InventoryService } from './service';
import { InventoryServiceErrors, InventoryAdjustmentType } from './types';
import { db } from '@db';
// import * as schema from '@shared/schema'; // Unused
import { SchemaValidationError } from '@shared/schema-validation';

// Mock DB and schema validation
jest.mock('@db', () => ({
  _query: {
    inventory: {
      _findFirst: jest.fn(),
      _findMany: jest.fn()
    },
    _products: {
      _findFirst: jest.fn()
    },
    _stores: {
      _findFirst: jest.fn()
    },
    _inventoryBatches: {
      _findFirst: jest.fn(),
      _findMany: jest.fn()
    }
  },
  _insert: jest.fn().mockReturnThis(),
  _update: jest.fn().mockReturnThis(),
  _delete: jest.fn().mockReturnThis(),
  _select: jest.fn().mockReturnThis(),
  _from: jest.fn().mockReturnThis(),
  _where: jest.fn().mockReturnThis(),
  _leftJoin: jest.fn().mockReturnThis(),
  _set: jest.fn().mockReturnThis(),
  _orderBy: jest.fn().mockReturnThis(),
  _limit: jest.fn().mockReturnThis(),
  _offset: jest.fn().mockReturnThis(),
  _returning: jest.fn(),
  _transaction: jest.fn().mockImplementation(async(fn) => await fn(db)),
  $_with: jest.fn().mockReturnThis(),
  _as: jest.fn().mockReturnThis()
}));

jest.mock('@shared/schema-validation', () => ({
  _inventoryValidation: {
    _insert: jest.fn(data => data),
    _update: jest.fn(data => data),
    _adjustment: jest.fn(data => data),
    _batch: {
      _insert: jest.fn(data => data)
    }
  },
  _SchemaValidationError: class SchemaValidationError extends Error {
    constructor(_message: string, options?: any) {
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

describe('InventoryService', () => {
  let _inventoryService: InventoryService;

  beforeEach(() => {
    inventoryService = new InventoryService();
    jest.clearAllMocks();
  });

  describe('createInventory', () => {
    const validInventoryData = {
      _productId: 1,
      _storeId: 1,
      _totalQuantity: 100,
      _availableQuantity: 100,
      _minimumLevel: 10,
      _batchTracking: false
    };

    it('should create a new inventory record with validated data', async() => {
      // Mock product and store existence
      (db.query.products.findFirst as jest.Mock).mockResolvedValue({ _id: 1, _name: 'Test Product' });
      (db.query.stores.findFirst as jest.Mock).mockResolvedValue({ _id: 1, _name: 'Test Store' });

      // Mock no existing inventory
      (db.query.inventory.findFirst as jest.Mock).mockResolvedValue(null);

      // Mock returning to return the created inventory
      (db.insert().values().returning as jest.Mock).mockResolvedValue([
        { _id: 1, ...validInventoryData }
      ]);

      const result = await inventoryService.createInventory(validInventoryData);

      // Check that validation was called
      expect(require('@shared/schema-validation').inventoryValidation.insert).toHaveBeenCalled();

      // Check result has expected values
      expect(result).toEqual(expect.objectContaining({
        _id: 1,
        _productId: validInventoryData.productId,
        _storeId: validInventoryData.storeId,
        _totalQuantity: validInventoryData.totalQuantity
      }));
    });

    it('should update existing inventory if it already exists', async() => {
      // Mock product and store existence
      (db.query.products.findFirst as jest.Mock).mockResolvedValue({ _id: 1, _name: 'Test Product' });
      (db.query.stores.findFirst as jest.Mock).mockResolvedValue({ _id: 1, _name: 'Test Store' });

      // Mock existing inventory
      const existingInventory = { _id: 1, _productId: 1, _storeId: 1, _totalQuantity: 50 };
      (db.query.inventory.findFirst as jest.Mock).mockResolvedValue(existingInventory);

      // Mock the updateInventory method
      const updateSpy = jest.spyOn(inventoryService, 'updateInventory').mockResolvedValue(
        { ...existingInventory, _totalQuantity: validInventoryData.totalQuantity } as schema.Inventory
      );

      const result = await inventoryService.createInventory(validInventoryData);

      // Check that updateInventory was called instead of creating new
      expect(updateSpy).toHaveBeenCalledWith(1, expect.objectContaining({
        _totalQuantity: validInventoryData.totalQuantity
      }));

      // Check result has expected values
      expect(result).toEqual(expect.objectContaining({
        _id: 1,
        _productId: validInventoryData.productId,
        _totalQuantity: validInventoryData.totalQuantity
      }));

      updateSpy.mockRestore();
    });

    it('should throw error when product does not exist', async() => {
      // Mock product not found
      (db.query.products.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(inventoryService.createInventory(validInventoryData))
        .rejects.toThrow(InventoryServiceErrors.PRODUCT_NOT_FOUND.message);
    });

    it('should throw error when store does not exist', async() => {
      // Mock product exists but store doesn't
      (db.query.products.findFirst as jest.Mock).mockResolvedValue({ _id: 1, _name: 'Test Product' });
      (db.query.stores.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(inventoryService.createInventory(validInventoryData))
        .rejects.toThrow(InventoryServiceErrors.STORE_NOT_FOUND.message);
    });

    it('should handle validation errors properly', async() => {
      // Mock product and store existence
      (db.query.products.findFirst as jest.Mock).mockResolvedValue({ _id: 1, _name: 'Test Product' });
      (db.query.stores.findFirst as jest.Mock).mockResolvedValue({ _id: 1, _name: 'Test Store' });
      (db.query.inventory.findFirst as jest.Mock).mockResolvedValue(null);

      // Make validation throw an error
      (require('@shared/schema-validation').inventoryValidation.insert as jest.Mock)
        .mockImplementationOnce(() => {
          throw new SchemaValidationError('Invalid inventory data');
        });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(inventoryService.createInventory(validInventoryData))
        .rejects.toThrow();

      // Check that error was logged
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('adjustInventory', () => {
    const validAdjustmentData = {
      _productId: 1,
      _quantity: 10,
      _reason: 'Purchase',
      _type: InventoryAdjustmentType.PURCHASE,
      _userId: 1,
      _notes: 'Initial stock'
    };

    it('should adjust inventory quantities successfully', async() => {
      // Mock existing inventory
      const mockInventory = {
        _id: 1,
        _productId: 1,
        _storeId: 1,
        _totalQuantity: 100,
        _availableQuantity: 100,
        _minimumLevel: 10,
        _batchTracking: false
      };

      // Mock getInventoryByProduct
      jest.spyOn(inventoryService, 'getInventoryByProduct').mockResolvedValue(mockInventory as schema.Inventory);

      // Mock transaction success
      (db.transaction as jest.Mock).mockImplementationOnce(async(fn) => {
        await fn(db);
        return true;
      });

      const result = await inventoryService.adjustInventory(validAdjustmentData);

      // Check that validation was called
      expect(require('@shared/schema-validation').inventoryValidation.adjustment).toHaveBeenCalled();

      // Check inventory was updated with new quantities
      expect(db.update).toHaveBeenCalled();
      expect(db.insert).toHaveBeenCalled(); // For the log entry

      // Check result
      expect(result).toBe(true);
    });

    it('should throw error when inventory not found', async() => {
      // Mock inventory not found
      jest.spyOn(inventoryService, 'getInventoryByProduct').mockResolvedValue(null);

      await expect(inventoryService.adjustInventory(validAdjustmentData))
        .rejects.toThrow(InventoryServiceErrors.INVENTORY_NOT_FOUND.message);
    });

    it('should throw error when insufficient stock for negative adjustment', async() => {
      // Mock existing inventory with insufficient stock
      const mockInventory = {
        _id: 1,
        _productId: 1,
        _storeId: 1,
        _totalQuantity: 5,
        _availableQuantity: 5,
        _minimumLevel: 10,
        _batchTracking: false
      };

      // Mock getInventoryByProduct
      jest.spyOn(inventoryService, 'getInventoryByProduct').mockResolvedValue(mockInventory as schema.Inventory);

      // Adjustment data with quantity more negative than available
      const negativeAdjustment = {
        ...validAdjustmentData,
        _quantity: -10,
        _type: InventoryAdjustmentType.SALE
      };

      await expect(inventoryService.adjustInventory(negativeAdjustment))
        .rejects.toThrow(InventoryServiceErrors.INSUFFICIENT_STOCK.message);
    });

    it('should handle batch tracking for negative adjustments', async() => {
      // Mock existing inventory with batch tracking
      const mockInventory = {
        _id: 1,
        _productId: 1,
        _storeId: 1,
        _totalQuantity: 100,
        _availableQuantity: 100,
        _minimumLevel: 10,
        _batchTracking: true
      };

      // Mock getInventoryByProduct
      jest.spyOn(inventoryService, 'getInventoryByProduct').mockResolvedValue(mockInventory as schema.Inventory);

      // Mock batch retrieval
      const mockBatch = {
        _id: 5,
        _productId: 1,
        _remainingQuantity: 20
      };
      (db.query.inventoryBatches.findFirst as jest.Mock).mockResolvedValue(mockBatch);

      // Adjustment data with batch ID
      const batchAdjustment = {
        ...validAdjustmentData,
        _quantity: -5,
        _type: InventoryAdjustmentType.SALE,
        _batchId: 5
      };

      // Mock transaction success
      (db.transaction as jest.Mock).mockImplementationOnce(async(fn) => {
        await fn(db);
        return true;
      });

      const result = await inventoryService.adjustInventory(batchAdjustment);

      // Check batch was updated
      expect(db.update).toHaveBeenCalledTimes(2); // Once for inventory, once for batch

      // Check result
      expect(result).toBe(true);
    });
  });

  describe('addInventoryBatch', () => {
    const validBatchData = {
      _productId: 1,
      _storeId: 1,
      _quantity: 50,
      _cost: '10.00',
      _purchaseDate: new Date(),
      _batchNumber: 'BATCH-123',
      _supplierReference: 'PO-456',
      _userId: 1
    };

    it('should add a new batch and adjust inventory accordingly', async() => {
      // Mock product existence
      (db.query.products.findFirst as jest.Mock).mockResolvedValue({ _id: 1, _name: 'Test Product' });

      // Mock existing inventory
      const mockInventory = {
        _id: 1,
        _productId: 1,
        _storeId: 1,
        _totalQuantity: 100,
        _availableQuantity: 100,
        _minimumLevel: 10,
        _batchTracking: true
      };

      // Mock getInventoryByProduct
      jest.spyOn(inventoryService, 'getInventoryByProduct').mockResolvedValue(mockInventory as any);

      // Mock batch creation
      (db.insert().values().returning as jest.Mock).mockResolvedValue([
        { _id: 1, ...validBatchData, _remainingQuantity: validBatchData.quantity }
      ]);

      // Mock adjustInventory
      jest.spyOn(inventoryService, 'adjustInventory').mockResolvedValue(true);

      const result = await inventoryService.addInventoryBatch(validBatchData);

      // Check that validation was called
      expect(require('@shared/schema-validation').inventoryValidation.batch.insert).toHaveBeenCalled();

      // Check batch was created
      expect(result).toEqual(expect.objectContaining({
        _id: 1,
        _productId: validBatchData.productId,
        _remainingQuantity: validBatchData.quantity
      }));

      // Check inventory was adjusted
      expect(inventoryService.adjustInventory).toHaveBeenCalledWith(expect.objectContaining({
        _productId: validBatchData.productId,
        _quantity: validBatchData.quantity,
        _type: InventoryAdjustmentType.PURCHASE
      }));
    });

    it('should create inventory if it does not exist', async() => {
      // Mock product existence
      (db.query.products.findFirst as jest.Mock).mockResolvedValue({ _id: 1, _name: 'Test Product' });

      // Mock no existing inventory
      jest.spyOn(inventoryService, 'getInventoryByProduct').mockResolvedValue(null);

      // Mock createInventory
      jest.spyOn(inventoryService, 'createInventory').mockResolvedValue({ _id: 1 } as schema.Inventory);

      // Mock batch creation
      (db.insert().values().returning as jest.Mock).mockResolvedValue([
        { _id: 1, ...validBatchData, _remainingQuantity: validBatchData.quantity }
      ]);

      // Mock adjustInventory
      jest.spyOn(inventoryService, 'adjustInventory').mockResolvedValue(true);

      await inventoryService.addInventoryBatch(validBatchData);

      // Check inventory was created
      expect(inventoryService.createInventory).toHaveBeenCalledWith(expect.objectContaining({
        _productId: validBatchData.productId,
        _storeId: validBatchData.storeId,
        _batchTracking: true
      }));
    });

    it('should enable batch tracking if not already enabled', async() => {
      // Mock product existence
      (db.query.products.findFirst as jest.Mock).mockResolvedValue({ _id: 1, _name: 'Test Product' });

      // Mock existing inventory without batch tracking
      const mockInventory = {
        _id: 1,
        _productId: 1,
        _storeId: 1,
        _totalQuantity: 100,
        _availableQuantity: 100,
        _minimumLevel: 10,
        _batchTracking: false
      };

      // Mock getInventoryByProduct
      jest.spyOn(inventoryService, 'getInventoryByProduct').mockResolvedValue(mockInventory as schema.Inventory);

      // Mock updateInventory
      jest.spyOn(inventoryService, 'updateInventory').mockResolvedValue({ ...mockInventory, _batchTracking: true } as schema.Inventory);

      // Mock batch creation
      (db.insert().values().returning as jest.Mock).mockResolvedValue([
        { _id: 1, ...validBatchData, _remainingQuantity: validBatchData.quantity }
      ]);

      // Mock adjustInventory
      jest.spyOn(inventoryService, 'adjustInventory').mockResolvedValue(true);

      await inventoryService.addInventoryBatch(validBatchData);

      // Check batch tracking was enabled
      expect(inventoryService.updateInventory).toHaveBeenCalledWith(
        mockInventory.id,
        { _batchTracking: true }
      );
    });

    it('should throw error when product does not exist', async() => {
      // Mock product not found
      (db.query.products.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(inventoryService.addInventoryBatch(validBatchData))
        .rejects.toThrow(InventoryServiceErrors.PRODUCT_NOT_FOUND.message);
    });
  });
});
