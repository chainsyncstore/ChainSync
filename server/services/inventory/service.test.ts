/**
 * Inventory Service Tests
 * 
 * This file contains tests for the refactored inventory service, focusing on
 * validation, error handling, and schema standardization.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { InventoryService } from './service';
import { InventoryServiceErrors, InventoryAdjustmentType } from './types';
import { db } from '@db';
import * as schema from '@shared/schema';
import { SchemaValidationError } from '@shared/schema-validation';

// Mock DB and schema validation
jest.mock('@db', () => ({
  query: {
    inventory: {
      findFirst: jest.fn(),
      findMany: jest.fn()
    },
    products: {
      findFirst: jest.fn()
    },
    stores: {
      findFirst: jest.fn()
    },
    inventoryBatches: {
      findFirst: jest.fn(),
      findMany: jest.fn()
    }
  },
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  leftJoin: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  offset: jest.fn().mockReturnThis(),
  returning: jest.fn(),
  transaction: jest.fn().mockImplementation(async (fn) => await fn(db)),
  $with: jest.fn().mockReturnThis(),
  as: jest.fn().mockReturnThis()
}));

jest.mock('@shared/schema-validation', () => ({
  inventoryValidation: {
    insert: jest.fn(data => data),
    update: jest.fn(data => data),
    adjustment: jest.fn(data => data),
    batch: {
      insert: jest.fn(data => data)
    }
  },
  SchemaValidationError: class SchemaValidationError extends Error {
    constructor(message: string, options?: any) {
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

describe('InventoryService', () => {
  let inventoryService: InventoryService;
  
  beforeEach(() => {
    inventoryService = new InventoryService();
    jest.clearAllMocks();
  });
  
  describe('createInventory', () => {
    const validInventoryData = {
      productId: 1,
      storeId: 1,
      totalQuantity: 100,
      availableQuantity: 100,
      minimumLevel: 10,
      batchTracking: false
    };
    
    it('should create a new inventory record with validated data', async () => {
      // Mock product and store existence
      (db.query.products.findFirst as jest.Mock).mockResolvedValue({ id: 1, name: 'Test Product' });
      (db.query.stores.findFirst as jest.Mock).mockResolvedValue({ id: 1, name: 'Test Store' });
      
      // Mock no existing inventory
      (db.query.inventory.findFirst as jest.Mock).mockResolvedValue(null);
      
      // Mock returning to return the created inventory
      (db.insert().values().returning as jest.Mock).mockResolvedValue([
        { id: 1, ...validInventoryData }
      ]);
      
      const result = await inventoryService.createInventory(validInventoryData);
      
      // Check that validation was called
      expect(require('@shared/schema-validation').inventoryValidation.insert).toHaveBeenCalled();
      
      // Check result has expected values
      expect(result).toEqual(expect.objectContaining({
        id: 1,
        productId: validInventoryData.productId,
        storeId: validInventoryData.storeId,
        totalQuantity: validInventoryData.totalQuantity
      }));
    });
    
    it('should update existing inventory if it already exists', async () => {
      // Mock product and store existence
      (db.query.products.findFirst as jest.Mock).mockResolvedValue({ id: 1, name: 'Test Product' });
      (db.query.stores.findFirst as jest.Mock).mockResolvedValue({ id: 1, name: 'Test Store' });
      
      // Mock existing inventory
      const existingInventory = { id: 1, productId: 1, storeId: 1, totalQuantity: 50 };
      (db.query.inventory.findFirst as jest.Mock).mockResolvedValue(existingInventory);
      
      // Mock the updateInventory method
      const updateSpy = jest.spyOn(inventoryService, 'updateInventory').mockResolvedValue(
        { ...existingInventory, totalQuantity: validInventoryData.totalQuantity } as any
      );
      
      const result = await inventoryService.createInventory(validInventoryData);
      
      // Check that updateInventory was called instead of creating new
      expect(updateSpy).toHaveBeenCalledWith(1, expect.objectContaining({
        totalQuantity: validInventoryData.totalQuantity
      }));
      
      // Check result has expected values
      expect(result).toEqual(expect.objectContaining({
        id: 1,
        productId: validInventoryData.productId,
        totalQuantity: validInventoryData.totalQuantity
      }));
      
      updateSpy.mockRestore();
    });
    
    it('should throw error when product does not exist', async () => {
      // Mock product not found
      (db.query.products.findFirst as jest.Mock).mockResolvedValue(null);
      
      await expect(inventoryService.createInventory(validInventoryData))
        .rejects.toThrow(InventoryServiceErrors.PRODUCT_NOT_FOUND.message);
    });
    
    it('should throw error when store does not exist', async () => {
      // Mock product exists but store doesn't
      (db.query.products.findFirst as jest.Mock).mockResolvedValue({ id: 1, name: 'Test Product' });
      (db.query.stores.findFirst as jest.Mock).mockResolvedValue(null);
      
      await expect(inventoryService.createInventory(validInventoryData))
        .rejects.toThrow(InventoryServiceErrors.STORE_NOT_FOUND.message);
    });
    
    it('should handle validation errors properly', async () => {
      // Mock product and store existence
      (db.query.products.findFirst as jest.Mock).mockResolvedValue({ id: 1, name: 'Test Product' });
      (db.query.stores.findFirst as jest.Mock).mockResolvedValue({ id: 1, name: 'Test Store' });
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
      productId: 1,
      quantity: 10,
      reason: 'Purchase',
      type: InventoryAdjustmentType.PURCHASE,
      userId: 1,
      notes: 'Initial stock'
    };
    
    it('should adjust inventory quantities successfully', async () => {
      // Mock existing inventory
      const mockInventory = {
        id: 1,
        productId: 1,
        storeId: 1,
        totalQuantity: 100,
        availableQuantity: 100,
        minimumLevel: 10,
        batchTracking: false
      };
      
      // Mock getInventoryByProduct
      jest.spyOn(inventoryService, 'getInventoryByProduct').mockResolvedValue(mockInventory as any);
      
      // Mock transaction success
      (db.transaction as jest.Mock).mockImplementationOnce(async (fn) => {
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
    
    it('should throw error when inventory not found', async () => {
      // Mock inventory not found
      jest.spyOn(inventoryService, 'getInventoryByProduct').mockResolvedValue(null);
      
      await expect(inventoryService.adjustInventory(validAdjustmentData))
        .rejects.toThrow(InventoryServiceErrors.INVENTORY_NOT_FOUND.message);
    });
    
    it('should throw error when insufficient stock for negative adjustment', async () => {
      // Mock existing inventory with insufficient stock
      const mockInventory = {
        id: 1,
        productId: 1,
        storeId: 1,
        totalQuantity: 5,
        availableQuantity: 5,
        minimumLevel: 10,
        batchTracking: false
      };
      
      // Mock getInventoryByProduct
      jest.spyOn(inventoryService, 'getInventoryByProduct').mockResolvedValue(mockInventory as any);
      
      // Adjustment data with quantity more negative than available
      const negativeAdjustment = {
        ...validAdjustmentData,
        quantity: -10,
        type: InventoryAdjustmentType.SALE
      };
      
      await expect(inventoryService.adjustInventory(negativeAdjustment))
        .rejects.toThrow(InventoryServiceErrors.INSUFFICIENT_STOCK.message);
    });
    
    it('should handle batch tracking for negative adjustments', async () => {
      // Mock existing inventory with batch tracking
      const mockInventory = {
        id: 1,
        productId: 1,
        storeId: 1,
        totalQuantity: 100,
        availableQuantity: 100,
        minimumLevel: 10,
        batchTracking: true
      };
      
      // Mock getInventoryByProduct
      jest.spyOn(inventoryService, 'getInventoryByProduct').mockResolvedValue(mockInventory as any);
      
      // Mock batch retrieval
      const mockBatch = {
        id: 5,
        productId: 1,
        remainingQuantity: 20
      };
      (db.query.inventoryBatches.findFirst as jest.Mock).mockResolvedValue(mockBatch);
      
      // Adjustment data with batch ID
      const batchAdjustment = {
        ...validAdjustmentData,
        quantity: -5,
        type: InventoryAdjustmentType.SALE,
        batchId: 5
      };
      
      // Mock transaction success
      (db.transaction as jest.Mock).mockImplementationOnce(async (fn) => {
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
      productId: 1,
      storeId: 1,
      quantity: 50,
      cost: '10.00',
      purchaseDate: new Date(),
      batchNumber: 'BATCH-123',
      supplierReference: 'PO-456',
      userId: 1
    };
    
    it('should add a new batch and adjust inventory accordingly', async () => {
      // Mock product existence
      (db.query.products.findFirst as jest.Mock).mockResolvedValue({ id: 1, name: 'Test Product' });
      
      // Mock existing inventory
      const mockInventory = {
        id: 1,
        productId: 1,
        storeId: 1,
        totalQuantity: 100,
        availableQuantity: 100,
        minimumLevel: 10,
        batchTracking: true
      };
      
      // Mock getInventoryByProduct
      jest.spyOn(inventoryService, 'getInventoryByProduct').mockResolvedValue(mockInventory as any);
      
      // Mock batch creation
      (db.insert().values().returning as jest.Mock).mockResolvedValue([
        { id: 1, ...validBatchData, remainingQuantity: validBatchData.quantity }
      ]);
      
      // Mock adjustInventory
      jest.spyOn(inventoryService, 'adjustInventory').mockResolvedValue(true);
      
      const result = await inventoryService.addInventoryBatch(validBatchData);
      
      // Check that validation was called
      expect(require('@shared/schema-validation').inventoryValidation.batch.insert).toHaveBeenCalled();
      
      // Check batch was created
      expect(result).toEqual(expect.objectContaining({
        id: 1,
        productId: validBatchData.productId,
        remainingQuantity: validBatchData.quantity
      }));
      
      // Check inventory was adjusted
      expect(inventoryService.adjustInventory).toHaveBeenCalledWith(expect.objectContaining({
        productId: validBatchData.productId,
        quantity: validBatchData.quantity,
        type: InventoryAdjustmentType.PURCHASE
      }));
    });
    
    it('should create inventory if it does not exist', async () => {
      // Mock product existence
      (db.query.products.findFirst as jest.Mock).mockResolvedValue({ id: 1, name: 'Test Product' });
      
      // Mock no existing inventory
      jest.spyOn(inventoryService, 'getInventoryByProduct').mockResolvedValue(null);
      
      // Mock createInventory
      jest.spyOn(inventoryService, 'createInventory').mockResolvedValue({ id: 1 } as any);
      
      // Mock batch creation
      (db.insert().values().returning as jest.Mock).mockResolvedValue([
        { id: 1, ...validBatchData, remainingQuantity: validBatchData.quantity }
      ]);
      
      // Mock adjustInventory
      jest.spyOn(inventoryService, 'adjustInventory').mockResolvedValue(true);
      
      await inventoryService.addInventoryBatch(validBatchData);
      
      // Check inventory was created
      expect(inventoryService.createInventory).toHaveBeenCalledWith(expect.objectContaining({
        productId: validBatchData.productId,
        storeId: validBatchData.storeId,
        batchTracking: true
      }));
    });
    
    it('should enable batch tracking if not already enabled', async () => {
      // Mock product existence
      (db.query.products.findFirst as jest.Mock).mockResolvedValue({ id: 1, name: 'Test Product' });
      
      // Mock existing inventory without batch tracking
      const mockInventory = {
        id: 1,
        productId: 1,
        storeId: 1,
        totalQuantity: 100,
        availableQuantity: 100,
        minimumLevel: 10,
        batchTracking: false
      };
      
      // Mock getInventoryByProduct
      jest.spyOn(inventoryService, 'getInventoryByProduct').mockResolvedValue(mockInventory as any);
      
      // Mock updateInventory
      jest.spyOn(inventoryService, 'updateInventory').mockResolvedValue({ ...mockInventory, batchTracking: true } as any);
      
      // Mock batch creation
      (db.insert().values().returning as jest.Mock).mockResolvedValue([
        { id: 1, ...validBatchData, remainingQuantity: validBatchData.quantity }
      ]);
      
      // Mock adjustInventory
      jest.spyOn(inventoryService, 'adjustInventory').mockResolvedValue(true);
      
      await inventoryService.addInventoryBatch(validBatchData);
      
      // Check batch tracking was enabled
      expect(inventoryService.updateInventory).toHaveBeenCalledWith(
        mockInventory.id,
        { batchTracking: true }
      );
    });
    
    it('should throw error when product does not exist', async () => {
      // Mock product not found
      (db.query.products.findFirst as jest.Mock).mockResolvedValue(null);
      
      await expect(inventoryService.addInventoryBatch(validBatchData))
        .rejects.toThrow(InventoryServiceErrors.PRODUCT_NOT_FOUND.message);
    });
  });
});
