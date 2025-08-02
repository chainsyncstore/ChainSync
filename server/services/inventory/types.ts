/**
 * Inventory Service Types
 *
 * This file defines the interfaces and types for the inventory service.
 */

import * as schema from '@shared/schema';

export type Inventory = schema.SelectInventory & {
  name?: string;
  description?: string;
  location?: string;
  capacity?: number;
  isActive?: boolean;
  batchTracking?: boolean;
  metadata?: Record<string, unknown>
};


export interface InventoryItem {
  id: number;
  inventoryId: number;
  productId: number;
  sku?: string;
  name: string;
  description?: string;
  category?: string;
  quantity: number;
  unit: string;
  unitCost?: string;
  reorderLevel?: number;
  reorderQuantity?: number;
  batchNumber?: string;
  serialNumber?: string;
  supplier?: string;
  isActive: boolean;
  metadata?: Record<string, unknown>;
  notes?: string;
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
  notes?: string;
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
  notes?: string;
}

export enum InventoryTransactionType {
  PURCHASE = 'purchase',
  SALE = 'sale',
  RECEIVE = 'receive',
  RETURN = 'return',
  DAMAGE = 'damage',
  LOSS = 'loss',
  TRANSFER = 'transfer',
  ADJUSTMENT = 'adjustment',
  COUNT = 'count'
}

export type InventoryTransaction = {
  id: number;
  inventoryId: number;
  itemId?: number;
  productId: number;
  quantity: number;
  beforeQuantity: number;
  afterQuantity: number;
  unitCost: string;
  totalCost: string;
  referenceId?: string;
  transactionType: InventoryTransactionType;
  reason?: string;
  performedBy: number;
  metadata?: Record<string, unknown>;
  notes?: string;
  createdAt: Date;
};

// Alias to maintain backwards compatibility
export enum InventoryAdjustmentType {
  PURCHASE = 'purchase',
  SALE = 'sale',
  RETURN = 'return',
  DAMAGE = 'damage',
  LOSS = 'loss',
  TRANSFER = 'transfer',
  ADJUSTMENT = 'adjustment',
  COUNT = 'count'
}

export interface CreateInventoryParams {
  productId: number;
  storeId: number;
  totalQuantity: number;
  availableQuantity: number;
  minimumLevel: number;
  batchTracking?: boolean;
  currentUtilization?: number;
  metadata?: Record<string, unknown>;
  name?: string;
  description?: string;
}
export interface UpdateInventoryParams {
  storeId?: number;
  productId?: number;
  totalQuantity?: number;
  availableQuantity?: number;
  minimumLevel?: number;
  batchTracking?: boolean;
  currentUtilization?: number;
  metadata?: Record<string, unknown>;
  notes?: string;
}
export interface InventoryAdjustmentParams {
  inventoryId?: number;
  itemId?: number;
  productId: number;
  quantity: number;
  unitCost?: string;
  reason: string;
  transactionType: InventoryTransactionType;
  userId: number;
  batchId?: number;
  referenceId?: string;
  performedBy?: number;
  metadata?: Record<string, unknown>;
  notes?: string;
}


export interface InventoryBatchParams {
  inventoryId?: number;
  productId: number;
  storeId: number;
  quantity: number;
  unitCost: string;
  purchaseDate: Date;
  manufactureDate?: Date;
  expiryDate?: Date;
  batchNumber?: string;
  sku?: string;
  unit?: string;
  supplier?: string;
  supplierReference?: string;
  referenceId?: string;
  performedBy?: number;
  metadata?: Record<string, unknown>;
  notes?: string;
}


export interface InventorySearchParams {
  storeId: number;
  query?: string;
  productId?: number;
  keyword?: string;
  categoryId?: number;
  lowStock?: boolean;
  outOfStock?: boolean;
  batchTracking?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
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
  INVALID_BATCH_OPERATION: new Error('Invalid batch operation')
};

export interface IInventoryService {
  createInventory(params: CreateInventoryParams): Promise<schema.Inventory>;
  updateInventory(inventoryId: number, params: UpdateInventoryParams): Promise<schema.Inventory>;
  getInventoryByProduct(productId: number): Promise<schema.Inventory | null>;
  getInventoryByStore(storeId: number, page?: number, limit?: number): Promise<{
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
  }>;
  adjustInventory(params: InventoryAdjustmentParams): Promise<boolean>;
  addInventoryBatch(params: InventoryBatchParams): Promise<InventoryItem>;
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
    }>
  }>;
}
