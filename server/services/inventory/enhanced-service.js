'use strict';
/**
 * Enhanced Inventory Service
 *
 * A refactored version of the Inventory service that uses the enhanced
 * base service and utility abstractions to reduce code duplication and
 * improve type safety.
 */
const __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
  if (k2 === undefined) k2 = k;
  let desc = Object.getOwnPropertyDescriptor(m, k);
  if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
    desc = { _enumerable: true, _get: function() { return m[k]; } };
  }
  Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
  if (k2 === undefined) k2 = k;
  o[k2] = m[k];
}));
const __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
  Object.defineProperty(o, 'default', { _enumerable: true, _value: v });
}) : function(o, v) {
  o['default'] = v;
});
const __importStar = (this && this.__importStar) || (function() {
  let ownKeys = function(o) {
    ownKeys = Object.getOwnPropertyNames || function(o) {
      const ar = [];
      for (const k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
      return ar;
    };
    return ownKeys(o);
  };
  return function(mod) {
    if (mod && mod.__esModule) return mod;
    const result = {};
    if (mod != null) for (let k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== 'default') __createBinding(result, mod, k[i]);
    __setModuleDefault(result, mod);
    return result;
  };
})();
Object.defineProperty(exports, '__esModule', { _value: true });
exports.EnhancedInventoryService = void 0;
const enhanced_service_1 = require('../base/enhanced-service');
const formatter_1 = require('./formatter');
const schema_validation_1 = require('@shared/schema-validation');
const types_1 = require('./types');
const db_1 = require('@server/db');
const drizzle_orm_1 = require('drizzle-orm');
const schema = __importStar(require('@shared/schema'));
class EnhancedInventoryService extends enhanced_service_1.EnhancedBaseService {
  constructor() {
    super(...arguments);
    this.inventoryFormatter = new formatter_1.InventoryFormatter();
    this.itemFormatter = new formatter_1.InventoryItemFormatter();
    this.transactionFormatter = new formatter_1.InventoryTransactionFormatter();
  }
  getInventoryByStore(storeId, page, limit) {
    throw new Error('Method not implemented.');
  }
  searchInventory(params) {
    throw new Error('Method not implemented.');
  }
  addInventoryBatch(params) {
    throw new Error('Method not implemented.');
  }
  getBatchesByProduct(productId) {
    throw new Error('Method not implemented.');
  }
  getLowStockItems(storeId, limit) {
    throw new Error('Method not implemented.');
  }
  getInventoryValuation(storeId) {
    throw new Error('Method not implemented.');
  }
  /* -------------------------------------------------------------------------- */
  /*                               CRUD – INVENTORY                             */
  /* -------------------------------------------------------------------------- */
  async createInventory(params) {
    try {
      const product = await this.getProductById(params.productId);
      if (!product)
        throw types_1.InventoryServiceErrors.PRODUCT_NOT_FOUND;
      const store = await this.getStoreById(params.storeId);
      if (!store)
        throw types_1.InventoryServiceErrors.STORE_NOT_FOUND;
      const existing = await this.getInventoryByProduct(params.productId, params.storeId);
      if (existing)
        return this.updateInventory(existing.id, params);
      const data = {
        ...params,
        _currentUtilization: params.currentUtilization ?? 0,
        _lastAuditDate: new Date(),
        _createdAt: new Date(),
        _updatedAt: new Date(),
        _metadata: params.metadata ? JSON.stringify(params.metadata) : null
      };
      const validated = (0, schema_validation_1.validateEntity)(schema_validation_1.inventoryValidation.insert, data, 'inventory');
      const [inv] = await db_1.db.insert(schema.inventory).values(validated).returning();
      return this.ensureExists(inv, 'Inventory');
    }
    catch (err) {
      return this.handleError(err, 'creating inventory');
    }
  }
  async updateInventory(id, params) {
    try {
      const existing = await this.getInventoryById(id);
      if (!existing)
        throw types_1.InventoryServiceErrors.INVENTORY_NOT_FOUND;
      const data = {
        ...params,
        _updatedAt: new Date(),
        _metadata: params.metadata
          ? JSON.stringify(params.metadata)
          : existing.metadata
      };
      const validated = (0, schema_validation_1.validateEntity)(schema_validation_1.inventoryValidation.update, data, 'inventory');
      const [updated] = await db_1.db
        .update(schema.inventory)
        .set(validated)
        .where((0, drizzle_orm_1.eq)(schema.inventory.id, id))
        .returning();
      return this.ensureExists(updated, 'Inventory');
    }
    catch (err) {
      return this.handleError(err, 'updating inventory');
    }
  }
  /* -------------------------------------------------------------------------- */
  /*                             READ/QUERY HELPERS                             */
  /* -------------------------------------------------------------------------- */
  async getInventoryById(id) {
    try {
      const inventory = await db_1.db.query.inventory.findFirst({
        _where: (0, drizzle_orm_1.eq)(schema.inventory.id, id)
      });
      return inventory ? _inventory : null;
    }
    catch (err) {
      return this.handleError(err, 'getting inventory by ID');
    }
  }
  async getInventoryByProduct(productId, storeId) {
    try {
      const inventory = await db_1.db.query.inventory.findFirst({
        _where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.inventory.productId, productId), storeId ? (0, drizzle_orm_1.eq)(schema.inventory.storeId, storeId) : undefined)
      });
      return inventory ? _inventory : null;
    }
    catch (err) {
      return this.handleError(err, 'getting inventory by product');
    }
  }
  /* -------------------------------------------------------------------------- */
  /*                             INVENTORY ITEMS                                */
  /* -------------------------------------------------------------------------- */
  async createInventoryItem(params) {
    try {
      const inventory = await this.getInventoryById(params.inventoryId);
      if (!inventory)
        throw types_1.InventoryServiceErrors.INVENTORY_NOT_FOUND;
      const product = await this.getProductById(params.productId);
      if (!product)
        throw types_1.InventoryServiceErrors.PRODUCT_NOT_FOUND;
      const data = {
        ...params,
        _sku: params.sku ?? `SKU-${params.productId}-${Date.now()}`,
        _quantity: params.quantity ?? 0,
        _reorderLevel: params.reorderLevel ?? 0,
        _reorderQuantity: params.reorderQuantity ?? 0,
        _receivedDate: params.receivedDate ?? new Date(),
        _createdAt: new Date(),
        _updatedAt: new Date(),
        _metadata: params.metadata ? JSON.stringify(params.metadata) : null
      };
      const validated = (0, schema_validation_1.validateEntity)(schema_validation_1.inventoryValidation.itemInsert, data, 'inventory_item');
      const [item] = await db_1.db
        .insert(schema.inventoryItems)
        .values(validated)
        .returning();
      await this.updateInventoryUtilization(params.inventoryId);
      return this.ensureExists(item, 'Inventory Item');
    }
    catch (err) {
      return this.handleError(err, 'creating inventory item');
    }
  }
  async updateInventoryItem(itemId, params) {
    try {
      const existing = await this.getInventoryItemById(itemId);
      if (!existing) {
        // _TODO: Add specific error code 'INVENTORY_ITEM_NOT_FOUND' to InventoryServiceErrors.
        throw types_1.InventoryServiceErrors.INVENTORY_NOT_FOUND;
      }
      const data = {
        ...params,
        _updatedAt: new Date(),
        _metadata: params.metadata
          ? JSON.stringify(params.metadata)
          : existing.metadata
      };
      const validated = (0, schema_validation_1.validateEntity)(schema_validation_1.inventoryValidation.itemUpdate, data, 'inventory_item');
      const [updated] = await db_1.db
        .update(schema.inventoryItems)
        .set(validated)
        .where((0, drizzle_orm_1.eq)(schema.inventoryItems.id, itemId))
        .returning();
      if (params.quantity !== undefined &&
                params.quantity !== existing.quantity) {
        await this.updateInventoryUtilization(existing.inventoryId);
      }
      return this.ensureExists(updated, 'Inventory Item');
    }
    catch (err) {
      return this.handleError(err, 'updating inventory item');
    }
  }
  async getInventoryItemById(id) {
    try {
      const item = await db_1.db.query.inventoryItems.findFirst({
        _where: (0, drizzle_orm_1.eq)(schema.inventoryItems.id, id)
      });
      if (!item) {
        return null;
      }
      const product = await this.getProductById(item.productId);
      return {
        ...item,
        _sku: item.sku ?? undefined,
        _name: product?.name || '',
        _unit: product?.unit || '',
        _unitCost: product?.cost || '0',
        _isActive: product?.isActive || false,
        _reorderLevel: item.reorderLevel || 0,
        _reorderQuantity: item.reorderQuantity || 0,
        _createdAt: item.createdAt || new Date(),
        _updatedAt: item.updatedAt || new Date(),
        _metadata: item.metadata
      };
    }
    catch (err) {
      return this.handleError(err, 'getting inventory item by ID');
    }
  }
  /* -------------------------------------------------------------------------- */
  /*                             ADJUST / TRANSACT                              */
  /* -------------------------------------------------------------------------- */
  async adjustInventory(params) {
    try {
      if (!params.inventoryId) {
        throw new Error('inventoryId is required');
      }
      const inventory = await this.getInventoryById(params.inventoryId);
      if (!inventory)
        throw types_1.InventoryServiceErrors.INVENTORY_NOT_FOUND;
      if (!params.itemId) {
        throw new Error('itemId is required');
      }
      const item = await this.getInventoryItemById(params.itemId);
      if (!item)
        throw types_1.InventoryServiceErrors.INVENTORY_NOT_FOUND;
      const beforeQty = item.quantity;
      const afterQty = beforeQty + params.quantity;
      if (params.quantity < 0 && afterQty < 0)
        throw types_1.InventoryServiceErrors.INSUFFICIENT_STOCK;
      await this.updateInventoryItem(item.id, { _quantity: afterQty });
      const txData = {
        _inventoryId: params.inventoryId,
        _itemId: params.itemId,
        _transactionType: params.transactionType ?? 'adjustment',
        _quantity: params.quantity,
        _beforeQuantity: beforeQty,
        _afterQuantity: afterQty,
        _unitCost: params.unitCost ?? item.unitCost,
        _totalCost: (Number(params.unitCost ?? item.unitCost) * Math.abs(params.quantity)).toFixed(2),
        _referenceId: params.referenceId,
        _notes: params.notes ?? '',
        _performedBy: params.performedBy,
        _transactionDate: new Date(),
        _createdAt: new Date(),
        _updatedAt: new Date(),
        _metadata: params.metadata ? JSON.stringify(params.metadata) : null
      };
      const validated = (0, schema_validation_1.validateEntity)(schema_validation_1.inventoryValidation.transactionInsert, txData, 'inventory_transaction');
      const [tx] = await db_1.db
        .insert(schema.inventoryTransactions)
        .values(validated)
        .returning();
      if (!params.inventoryId) {
        throw new Error('inventoryId is required');
      }
      await this.updateInventoryUtilization(params.inventoryId);
      this.ensureExists(tx, 'Inventory Transaction');
      return true;
    }
    catch (err) {
      return this.handleError(err, 'adjusting inventory');
    }
  }
  /* -------------------------------------------------------------------------- */
  /*                         UTIL – INVENTORY VALUATION ETC                     */
  /* -------------------------------------------------------------------------- */
  async updateInventoryUtilization(id) {
    try {
      const [sumRow] = await db_1.db
        .select({
          _total: (0, drizzle_orm_1.sql) `sum(${schema.inventoryItems.quantity})`.mapWith(Number)
        })
        .from(schema.inventoryItems)
        .where((0, drizzle_orm_1.eq)(schema.inventoryItems.inventoryId, id));
      const total = sumRow.total ?? 0;
      const [updated] = await db_1.db
        .update(schema.inventory)
        .set({ _currentUtilization: total })
        .where((0, drizzle_orm_1.eq)(schema.inventory.id, id))
        .returning();
      return updated;
    }
    catch (err) {
      console.error('Error updating inventory _utilization:', err);
      return null;
    }
  }
  /* -------------------------------------------------------------------------- */
  /*                            INTERNAL LOOK-UPS                               */
  /* -------------------------------------------------------------------------- */
  getProductById(productId) {
    return db_1.db.query.products.findFirst({
      _where: (0, drizzle_orm_1.eq)(schema.products.id, productId)
    });
  }
  getStoreById(storeId) {
    return db_1.db.query.stores.findFirst({
      _where: (0, drizzle_orm_1.eq)(schema.stores.id, storeId)
    });
  }
}
exports.EnhancedInventoryService = EnhancedInventoryService;
