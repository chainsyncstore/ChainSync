/**
 * Example Product Service Tests
 * 
 * This demonstrates how to test services using the standardized database access patterns.
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { productService, ProductService } from './product-service';
import { db } from '../../../db';
import { products, stores } from '@shared/schema';
import { sql } from 'drizzle-orm';
import { validateProduct } from '../../db/validation';

// Mock dependencies
vi.mock('../../../db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
    transaction: vi.fn()
  }
}));

vi.mock('../../db/sqlHelpers', async (importOriginal) => {
  // Import the actual module first
  const originalModule = await importOriginal<typeof import('../../db/sqlHelpers')>();
  
  // Return a mocked version
  return {
    ...originalModule,
    findById: vi.fn(),
    findMany: vi.fn(),
    insertOne: vi.fn(),
    updateById: vi.fn(),
    deleteById: vi.fn(),
    withTransaction: vi.fn(),
    executeRawQuery: vi.fn(),
    joinTables: vi.fn(),
    withDbTryCatch: vi.fn()
  };
});

vi.mock('../../db/validation', async (importOriginal) => {
  const originalModule = await importOriginal<typeof import('../../db/validation')>();
  
  return {
    ...originalModule,
    validateProduct: vi.fn(),
    validateArray: vi.fn()
  };
});

// Import mocked functions
import { 
  findById, 
  findMany, 
  insertOne, 
  updateById,
  deleteById,
  withTransaction,
  executeRawQuery,
  joinTables,
  withDbTryCatch
} from '../../db/sqlHelpers';

describe('ProductService', () => {
  // Sample data for tests
  const mockProduct = {
    id: 1,
    storeId: 1,
    name: 'Test Product',
    description: 'Test Description',
    sku: 'TEST-SKU-123',
    price: '19.99',
    stockQuantity: 100,
    isActive: true,
    createdAt: new Date(),
    updatedAt: null
  };
  
  const mockStore = {
    id: 1,
    name: 'Test Store'
  };
  
  beforeEach(() => {
    vi.resetAllMocks();
    
    // Default mock implementations
    (validateProduct as any).mockImplementation((data) => data);
  });
  
  describe('getProductById', () => {
    it('should get a product by ID', async () => {
      // Setup mock
      (findById as any).mockResolvedValue(mockProduct);
      
      // Execute
      const result = await productService.getProductById(1);
      
      // Assert
      expect(findById).toHaveBeenCalledWith(db, products, 'id', 1);
      expect(validateProduct).toHaveBeenCalledWith(mockProduct);
      expect(result).toEqual(mockProduct);
    });
    
    it('should return null if product not found', async () => {
      // Setup mock
      (findById as any).mockResolvedValue(null);
      
      // Execute
      const result = await productService.getProductById(999);
      
      // Assert
      expect(findById).toHaveBeenCalledWith(db, products, 'id', 999);
      expect(validateProduct).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
    
    it('should handle errors', async () => {
      // Setup mock
      const error = new Error('Database error');
      (findById as any).mockRejectedValue(error);
      
      // Execute & Assert
      await expect(productService.getProductById(1)).rejects.toThrow('Database error');
    });
  });
  
  describe('createProduct', () => {
    const newProductData = {
      storeId: 1,
      name: 'New Product',
      description: 'New Description',
      sku: 'NEW-SKU-123',
      price: 29.99,
      stockQuantity: 50,
      isActive: true
    };
    
    it('should create a new product', async () => {
      // Setup mock
      (insertOne as any).mockResolvedValue(mockProduct);
      
      // Execute
      const result = await productService.createProduct(newProductData);
      
      // Assert
      expect(insertOne).toHaveBeenCalled();
      expect(validateProduct).toHaveBeenCalledWith(mockProduct);
      expect(result).toEqual(mockProduct);
    });
    
    it('should validate input data', async () => {
      // Setup mock with invalid data
      const invalidData = { ...newProductData, price: -10 };
      
      // Execute & Assert
      await expect(productService.createProduct(invalidData)).rejects.toThrow();
    });
  });
  
  describe('updateProduct', () => {
    const updateData = {
      name: 'Updated Product',
      price: 39.99
    };
    
    it('should update an existing product', async () => {
      // Setup mock
      const updatedProduct = { ...mockProduct, ...updateData, price: '39.99' };
      (updateById as any).mockResolvedValue(updatedProduct);
      
      // Execute
      const result = await productService.updateProduct(1, updateData);
      
      // Assert
      expect(updateById).toHaveBeenCalled();
      expect(validateProduct).toHaveBeenCalledWith(updatedProduct);
      expect(result).toEqual(updatedProduct);
    });
    
    it('should return null if product not found', async () => {
      // Setup mock
      (updateById as any).mockResolvedValue(null);
      
      // Execute
      const result = await productService.updateProduct(999, updateData);
      
      // Assert
      expect(updateById).toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });
  
  describe('deleteProduct', () => {
    it('should delete a product by ID', async () => {
      // Setup mock
      (deleteById as any).mockResolvedValue(mockProduct);
      
      // Execute
      const result = await productService.deleteProduct(1);
      
      // Assert
      expect(deleteById).toHaveBeenCalledWith(db, products, 'id', 1);
      expect(validateProduct).toHaveBeenCalledWith(mockProduct);
      expect(result).toEqual(mockProduct);
    });
    
    it('should return null if product not found', async () => {
      // Setup mock
      (deleteById as any).mockResolvedValue(null);
      
      // Execute
      const result = await productService.deleteProduct(999);
      
      // Assert
      expect(deleteById).toHaveBeenCalledWith(db, products, 'id', 999);
      expect(result).toBeNull();
    });
  });
  
  describe('updateStockQuantities', () => {
    const updates = [
      { id: 1, quantity: 50 },
      { id: 2, quantity: 75 }
    ];
    
    it('should update stock quantities for multiple products', async () => {
      // Setup mock
      const updatedProducts = [
        { ...mockProduct, stockQuantity: 50 },
        { ...mockProduct, id: 2, stockQuantity: 75 }
      ];
      
      (withTransaction as any).mockImplementation(async (_, fn) => {
        return fn({});
      });
      
      (findById as any).mockResolvedValue(mockProduct);
      (updateById as any).mockImplementation((db, table, idField, id, data) => {
        return Promise.resolve({ ...mockProduct, id, ...data });
      });
      
      // Execute
      const result = await productService.updateStockQuantities(updates);
      
      // Assert
      expect(withTransaction).toHaveBeenCalled();
      expect(findById).toHaveBeenCalledTimes(2);
      expect(updateById).toHaveBeenCalledTimes(2);
      expect(result.length).toBe(2);
    });
    
    it('should throw error if a product is not found', async () => {
      // Setup mock
      (withTransaction as any).mockImplementation(async (_, fn) => {
        return fn({});
      });
      
      (findById as any).mockResolvedValueOnce(mockProduct).mockResolvedValueOnce(null);
      
      // Execute & Assert
      await expect(productService.updateStockQuantities(updates)).rejects.toThrow('Product with ID 2 not found');
    });
  });
});
