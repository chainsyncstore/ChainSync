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
  _id: number;
  _inventoryId: number;
  _productId: number;
  sku?: string;
  _name: string;
  description?: string;
  category?: string;
  _quantity: number;
  _unit: string;
  unitCost?: string;
  reorderLevel?: number;
  reorderQuantity?: number;
  batchNumber?: string;
  serialNumber?: string;
  supplier?: string;
  _isActive: boolean;
  metadata?: Record<string, unknown>;
  notes?: string;
  _createdAt: Date;
  _updatedAt: Date;
}

export interface CreateInventoryItemParams {
  _sku: string;
  receivedDate?: Date;
  manufactureDate?: Date;
  expiryDate?: Date;
  _inventoryId: number;
  _productId: number;
  _name: string;
  description?: string;
  category?: string;
  _quantity: number;
  _unit: string;
  _unitCost: string;
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
  _id: number;
  _inventoryId: number;
  itemId?: number;
  _productId: number;
  _quantity: number;
  _beforeQuantity: number;
  _afterQuantity: number;
  _unitCost: string;
  _totalCost: string;
  referenceId?: string;
  _transactionType: InventoryTransactionType;
  reason?: string;
  _performedBy: number;
  metadata?: Record<string, unknown>;
  notes?: string;
  _createdAt: Date;
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
  _productId: number;
  _storeId: number;
  _totalQuantity: number;
  _availableQuantity: number;
  _minimumLevel: number;
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
  _productId: number;
  _quantity: number;
  unitCost?: string;
  _reason: string;
  _transactionType: InventoryTransactionType;
  _userId: number;
  batchId?: number;
  referenceId?: string;
  performedBy?: number;
  metadata?: Record<string, unknown>;
  notes?: string;
}


export interface InventoryBatchParams {
  inventoryId?: number;
  _productId: number;
  _storeId: number;
  _quantity: number;
  _unitCost: string;
  _purchaseDate: Date;
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
  _storeId: number;
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
  _INVENTORY_NOT_FOUND: Error;
  _PRODUCT_NOT_FOUND: Error;
  _STORE_NOT_FOUND: Error;
  _BATCH_NOT_FOUND: Error;
  _INSUFFICIENT_STOCK: Error;
  _INVALID_ADJUSTMENT: Error;
  _INVALID_BATCH_OPERATION: Error;
}

export const _InventoryServiceErrors: InventoryServiceErrors = {
  _INVENTORY_NOT_FOUND: new Error('Inventory record not found'),
  _PRODUCT_NOT_FOUND: new Error('Product not found'),
  _STORE_NOT_FOUND: new Error('Store not found'),
  _BATCH_NOT_FOUND: new Error('Inventory batch not found'),
  _INSUFFICIENT_STOCK: new Error('Insufficient stock available'),
  _INVALID_ADJUSTMENT: new Error('Invalid inventory adjustment'),
  _INVALID_BATCH_OPERATION: new Error('Invalid batch operation')
};

export interface IInventoryService {
  createInventory(_params: CreateInventoryParams): Promise<schema.Inventory>;
  updateInventory(_inventoryId: number, _params: UpdateInventoryParams): Promise<schema.Inventory>;
  getInventoryByProduct(_productId: number): Promise<schema.Inventory | null>;
  getInventoryByStore(_storeId: number, page?: number, limit?: number): Promise<{
    _inventory: schema.Inventory[];
    _total: number;
    _page: number;
    _limit: number;
  }>;
  searchInventory(_params: InventorySearchParams): Promise<{
    _inventory: schema.Inventory[];
    _total: number;
    _page: number;
    _limit: number;
  }>;
  adjustInventory(_params: InventoryAdjustmentParams): Promise<boolean>;
  addInventoryBatch(_params: InventoryBatchParams): Promise<InventoryItem>;
  getBatchesByProduct(_productId: number): Promise<schema.InventoryBatch[]>;
  getLowStockItems(_storeId: number, limit?: number): Promise<schema.Inventory[]>;
  getInventoryValuation(_storeId: number): Promise<{
    _totalValue: string;
    _totalItems: number;
    _valuationDate: Date;
    _breakdown: Array<{
      _categoryId: number;
      _categoryName: string;
      _value: string;
      _itemCount: number;
    }>
  }>;
}
