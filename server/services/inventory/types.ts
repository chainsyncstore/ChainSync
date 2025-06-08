/**
 * Inventory Service Types
 *
 * This file defines the interfaces and types for the inventory service.
 */

import * as schema from '@shared/schema';

export type Inventory = schema.Inventory & {
  batchTracking?: boolean;
  metadata?: Record<string, unknown>;
};

export interface InventoryItem {
  id: number;
  inventoryId: number;
  productId: number;
  name: string;
  description?: string;
  category?: string;
  quantity: number;
  unit: string;
  unitCost: string;
  reorderLevel?: number;
  reorderQuantity?: number;
  batchNumber?: string;
  serialNumber?: string;
  supplier?: string;
  isActive: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateInventoryItemParams {
  sku: string;
  receivedDate?: Date;
  manufactureDate?: Date;
  expiryDate?: Date;
  inventoryId: number;
  productId: number;
  name: string;
  description?: string;
  category?: string;
  quantity: number;
  unit: string;
  unitCost: string;
  reorderLevel?: number;
  reorderQuantity?: number;
  batchNumber?: string;
  serialNumber?: string;
  supplier?: string;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpdateInventoryItemParams {
  name?: string;
  description?: string;
  category?: string;
  quantity?: number;
  unit?: string;
  unitCost?: string;
  reorderLevel?: number;
  reorderQuantity?: number;
  batchNumber?: string;
  serialNumber?: string;
  supplier?: string;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

export enum InventoryAdjustmentType {
  PURCHASE = 'purchase',
  SALE = 'sale',
  RETURN = 'return',
  DAMAGE = 'damage',
  LOSS = 'loss',
  TRANSFER = 'transfer',
  ADJUSTMENT = 'adjustment',
  COUNT = 'count',
}

export interface CreateInventoryParams {
  productId: number;
  storeId: number;
  totalQuantity: number;
  availableQuantity: number;
  minimumLevel: number;
  batchTracking?: boolean;
}

export interface UpdateInventoryParams {
  totalQuantity?: number;
  availableQuantity?: number;
  minimumLevel?: number;
  batchTracking?: boolean;
}

export interface InventoryAdjustmentParams {
  productId: number;
  storeId: number; // Added storeId
  quantity: number;
  reason: string;
  type: InventoryAdjustmentType;
  userId: number;
  batchId?: number;
  cost?: string;
  notes?: string;
  reference?: string;
}

export interface InventoryBatchParams {
  productId: number;
  storeId: number;
  quantity: number;
  cost: string;
  purchaseDate: Date;
  expiryDate?: Date;
  batchNumber?: string;
  supplierReference?: string;
  notes?: string;
  userId: number;
}

export interface InventorySearchParams {
  storeId: number;
  query?: string;
  categoryId?: number;
  lowStock?: boolean;
  outOfStock?: boolean;
  batchTracking?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc'; // Standardized to sortOrder
}

export interface InventoryServiceErrors {
  INVENTORY_NOT_FOUND: Error;
  PRODUCT_NOT_FOUND: Error;
  STORE_NOT_FOUND: Error;
  BATCH_NOT_FOUND: Error;
  INSUFFICIENT_STOCK: Error;
  INVALID_ADJUSTMENT: Error;
  INVALID_BATCH_OPERATION: Error;
}

export const InventoryServiceErrors: InventoryServiceErrors = {
  INVENTORY_NOT_FOUND: new Error('Inventory record not found'),
  PRODUCT_NOT_FOUND: new Error('Product not found'),
  STORE_NOT_FOUND: new Error('Store not found'),
  BATCH_NOT_FOUND: new Error('Inventory batch not found'),
  INSUFFICIENT_STOCK: new Error('Insufficient stock available'),
  INVALID_ADJUSTMENT: new Error('Invalid inventory adjustment'),
  INVALID_BATCH_OPERATION: new Error('Invalid batch operation'),
};

// Renaming InventoryAdjustmentType to InventoryTransactionType for clarity if used broadly
export { InventoryAdjustmentType as InventoryTransactionType };

export interface InventoryTransaction {
  id: number;
  inventoryId: number;
  itemId?: number; // Optional if transaction is for inventory as a whole
  batchId?: number; // Optional
  transactionType: InventoryAdjustmentType; // Using the existing enum
  quantity: number;
  beforeQuantity: number;
  afterQuantity: number;
  unitCost?: string; // Optional, might not apply to all transaction types
  totalCost?: string; // Optional
  referenceId?: string; // e.g., order ID, transfer ID
  notes?: string;
  performedBy?: number; // User ID
  transactionDate: Date;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface IInventoryService {
  createInventory(params: CreateInventoryParams): Promise<schema.Inventory>;
  updateInventory(inventoryId: number, params: UpdateInventoryParams): Promise<schema.Inventory>;
  getInventoryByProduct(productId: number): Promise<schema.Inventory | null>;
  getInventoryByStore(
    storeId: number,
    page?: number,
    limit?: number
  ): Promise<{
    inventory: schema.Inventory[];
    total: number;
    page: number;
    limit: number;
  }>;
  searchInventory(params: InventorySearchParams): Promise<{
    inventory: schema.Inventory[];
    total: number;
    page: number;
    limit: number;
    totalPages: number; // Add totalPages
  }>;
  adjustInventory(params: InventoryAdjustmentParams): Promise<boolean>;
  addInventoryBatch(params: InventoryBatchParams): Promise<schema.InventoryBatch>;
  getBatchesByProduct(productId: number): Promise<schema.InventoryBatch[]>;
  getLowStockItems(storeId: number, limit?: number): Promise<schema.Inventory[]>;
  getInventoryValuation(storeId: number): Promise<{
    totalValue: string;
    totalItems: number;
    valuationDate: Date;
    breakdown: Array<{
      categoryId: number;
      categoryName: string;
      value: string;
      itemCount: number;
    }>;
  }>;
}
