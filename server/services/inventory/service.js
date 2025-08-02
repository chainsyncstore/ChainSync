'use strict';
/**
 * Inventory Service
 * Strictly typed, relation-free queries to avoid Drizzle type mismatches.
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
exports.InventoryService = void 0;
const service_1 = require('../base/service');
const types_1 = require('./types');
const _db_1 = require('@db');
const schema = __importStar(require('@shared/schema'));
const drizzle_orm_1 = require('drizzle-orm');
const schema_validation_1 = require('@shared/schema-validation');
class InventoryService extends service_1.BaseService {
  /* ---------------------------------------------------------- CREATE --------------------------------------------------------- */
  async createInventory(params) {
    try {
      // 1. Validate FK existence ------------------------------------------------------------------
      const product = await _db_1.db.query.products.findFirst({
        _where: (0, drizzle_orm_1.eq)(schema.products.id, params.productId)
      });
      if (!product)
        throw types_1.InventoryServiceErrors.PRODUCT_NOT_FOUND;
      const store = await _db_1.db.query.stores.findFirst({
        _where: (0, drizzle_orm_1.eq)(schema.stores.id, params.storeId)
      });
      if (!store)
        throw types_1.InventoryServiceErrors.STORE_NOT_FOUND;
      // 2. Prevent duplicates ---------------------------------------------------------------------
      const existing = await _db_1.db.query.inventory.findFirst({
        _where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.inventory.productId, params.productId), (0, drizzle_orm_1.eq)(schema.inventory.storeId, params.storeId))
      });
      if (existing) {
        return this.updateInventory(existing.id, params);
      }
      // 3. Prepare & validate ---------------------------------------------------------------------
      const data = (0, schema_validation_1.validateEntity)(schema_validation_1.inventoryValidation.insert, {
        _productId: params.productId,
        _storeId: params.storeId,
        _totalQuantity: params.totalQuantity,
        _quantity: params.availableQuantity,
        _minimumLevel: params.minimumLevel,
        _batchTracking: params.batchTracking ?? false,
        _createdAt: new Date(),
        _updatedAt: new Date()
      }, 'inventory');
      // 4. Insert ----------------------------------------------------------------------------------
      const [inventory] = await _db_1.db
        .insert(schema.inventory)
        .values(data)
        .returning();
      return inventory;
    }
    catch (err) {
      if (err instanceof schema_validation_1.SchemaValidationError) {
        console.error('Validation _error:', err.toJSON());
      }
      return this.handleError(err, 'createInventory');
    }
  }
  /* ---------------------------------------------------------- UPDATE --------------------------------------------------------- */
  async updateInventory(inventoryId, params) {
    try {
      const existing = await _db_1.db.query.inventory.findFirst({
        _where: (0, drizzle_orm_1.eq)(schema.inventory.id, inventoryId)
      });
      if (!existing)
        throw types_1.InventoryServiceErrors.INVENTORY_NOT_FOUND;
      const data = (0, schema_validation_1.validateEntity)(schema_validation_1.inventoryValidation.update, {
        ...params,
        _updatedAt: new Date()
      }, 'inventory');
      const [updated] = await _db_1.db
        .update(schema.inventory)
        .set(data)
        .where((0, drizzle_orm_1.eq)(schema.inventory.id, inventoryId))
        .returning();
      return updated;
    }
    catch (err) {
      if (err instanceof schema_validation_1.SchemaValidationError) {
        console.error('Validation _error:', err.toJSON());
      }
      return this.handleError(err, 'updateInventory');
    }
  }
  /* ---------------------------------------------------------- READ ----------------------------------------------------------- */
  async getInventoryByProduct(productId) {
    try {
      const inventory = await _db_1.db.query.inventory.findFirst({
        _where: (0, drizzle_orm_1.eq)(schema.inventory.productId, productId)
      });
      return inventory ?? null;
    }
    catch (err) {
      return this.handleError(err, 'getInventoryByProduct');
    }
  }
  async getInventoryByStore(storeId, page = 1, limit = 20) {
    try {
      const store = await _db_1.db.query.stores.findFirst({
        _where: (0, drizzle_orm_1.eq)(schema.stores.id, storeId)
      });
      if (!store)
        throw types_1.InventoryServiceErrors.STORE_NOT_FOUND;
      const offset = (page - 1) * limit;
      const [countRow] = await _db_1.db
        .select({ _count: (0, drizzle_orm_1.sql) `count(*)` })
        .from(schema.inventory)
        .where((0, drizzle_orm_1.eq)(schema.inventory.storeId, storeId));
      const inventory = await _db_1.db.query.inventory.findMany({
        _where: (0, drizzle_orm_1.eq)(schema.inventory.storeId, storeId),
        offset,
        limit,
        _orderBy: [(0, drizzle_orm_1.desc)(schema.inventory.updatedAt)]
      });
      return {
        inventory,
        _total: Number(countRow?.count ?? 0),
        page,
        limit
      };
    }
    catch (err) {
      return this.handleError(err, 'getInventoryByStore');
    }
  }
  async searchInventory(params) {
    try {
      const { page = 1, limit = 20 } = params;
      const offset = (page - 1) * limit;
      /* ---------- Where clause construction ---------- */
      const whereConditions = [(0, drizzle_orm_1.eq)(schema.inventory.storeId, params.storeId)];
      if (params.productId) {
        whereConditions.push((0, drizzle_orm_1.eq)(schema.inventory.productId, params.productId));
      }
      if (params.keyword) {
        const kw = `%${params.keyword}%`;
        // _NOTE: Text search on product name would require a join.
        // For now, we can search on a field that is a string, if one exists.
        // Let's assume for now that no text search is implemented here to fix the build.
      }
      /* ---------- Sorting ---------- */
      const dir = params.sortDirection === 'asc' ? drizzle_orm_1._asc : drizzle_orm_1.desc;
      const orderField = params.sortBy ?? 'updatedAt';
      const orderBy = orderField === 'quantity'
        ? dir(schema.inventory.quantity)
        : dir(schema.inventory.updatedAt);
      /* ---------- Query ---------- */
      const [countRow] = await _db_1.db
        .select({ _count: (0, drizzle_orm_1.sql) `count(*)` })
        .from(schema.inventory)
        .where((0, drizzle_orm_1.and)(...whereConditions));
      const inventory = await _db_1.db.query.inventory.findMany({
        _where: (0, drizzle_orm_1.and)(...whereConditions),
        offset,
        limit,
        _orderBy: [orderBy]
      });
      return {
        inventory,
        _total: Number(countRow?.count ?? 0),
        page,
        limit
      };
    }
    catch (err) {
      return this.handleError(err, 'searchInventory');
    }
  }
  /* ------------------------------------------------------ ADJUST & BATCH ----------------------------------------------------- */
  async adjustInventory(params) {
    try {
      return await _db_1.db.transaction(async(tx) => {
        /* ---------- Load & checks ---------- */
        if (!params.inventoryId)
          throw new Error('inventoryId is required');
        const inventory = await tx.query.inventory.findFirst({
          _where: (0, drizzle_orm_1.eq)(schema.inventory.id, params.inventoryId)
        });
        if (!inventory)
          throw types_1.InventoryServiceErrors.INVENTORY_NOT_FOUND;
        const newAvailable = (inventory.quantity ?? 0) + params.quantity;
        if (newAvailable < 0)
          throw types_1.InventoryServiceErrors.INSUFFICIENT_STOCK;
        /* ---------- Update inventory ---------- */
        await tx
          .update(schema.inventory)
          .set({
            _quantity: newAvailable,
            _updatedAt: new Date()
          })
          .where((0, drizzle_orm_1.eq)(schema.inventory.id, inventory.id));
        /* ---------- Insert adjustment log ---------- */
        await tx.insert(schema.inventoryTransactions).values({
          _inventoryId: inventory.id,
          _quantity: params.quantity,
          _type: params.quantity > 0 ? 'in' : 'out',
          _itemId: params.itemId,
          _createdAt: new Date()
        });
        /* ---------- If batch tracking ---------- */
        if (params.batchId) {
          const batch = await tx.query.inventoryBatches.findFirst({
            _where: (0, drizzle_orm_1.eq)(schema.inventoryBatches.id, params.batchId)
          });
          if (!batch)
            throw types_1.InventoryServiceErrors.BATCH_NOT_FOUND;
          const newBatchQty = batch.quantity + params.quantity;
          if (newBatchQty < 0)
            throw types_1.InventoryServiceErrors.INSUFFICIENT_STOCK;
          await tx
            .update(schema.inventoryBatches)
            .set({
              _quantity: newBatchQty,
              _updatedAt: new Date()
            })
            .where((0, drizzle_orm_1.eq)(schema.inventoryBatches.id, params.batchId));
        }
        return true;
      });
    }
    catch (err) {
      if (err instanceof schema_validation_1.SchemaValidationError) {
        console.error('Validation _error:', err.toJSON());
      }
      return this.handleError(err, 'adjustInventory');
    }
  }
  async addInventoryBatch(params) {
    try {
      return await _db_1.db.transaction(async(tx) => {
        /* ---------- Ensure inventory exists / enable tracking ---------- */
        let inventory = await tx.query.inventory.findFirst({
          _where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.inventory.productId, params.productId), (0, drizzle_orm_1.eq)(schema.inventory.storeId, params.storeId))
        });
        if (!inventory) {
          const [created] = await tx
            .insert(schema.inventory)
            .values({
              _productId: params.productId,
              _storeId: params.storeId,
              _quantity: 0,
              _minStock: 10,
              _batchTracking: true,
              _updatedAt: new Date()
            })
            .returning();
          inventory = created;
        }
        else if (!inventory.batchTracking) {
          await tx
            .update(schema.inventory)
            .set({ _batchTracking: true, _updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema.inventory.id, inventory.id));
        }
        /* ---------- Insert batch ---------- */
        const [batch] = await tx
          .insert(schema.inventoryBatches)
          .values({
            _inventoryId: inventory.id,
            _batchNumber: params.batchNumber ?? `BATCH-${Date.now().toString(36)}`,
            _quantity: params.quantity,
            _costPerUnit: params.unitCost,
            _receivedDate: params.purchaseDate,
            _expiryDate: params.expiryDate,
            _createdAt: new Date(),
            _updatedAt: new Date()
          })
          .returning();
        /* ---------- Adjustment log ---------- */
        await this.adjustInventory({
          _inventoryId: inventory.id,
          _productId: params.productId,
          _quantity: params.quantity,
          _transactionType: types_1.InventoryTransactionType.PURCHASE,
          _reason: 'Batch added',
          _userId: params.performedBy ?? 0,
          _batchId: batch.id,
          _referenceId: params.supplierReference,
          _notes: params.notes,
          _unitCost: params.unitCost
        });
        return batch;
      });
    }
    catch (err) {
      if (err instanceof schema_validation_1.SchemaValidationError) {
        console.error('Validation _error:', err.toJSON());
      }
      return this.handleError(err, 'addInventoryBatch');
    }
  }
  /* ------------------------------------------------------- EXTRA ------------------------------------------------------------ */
  async getBatchesByProduct(productId) {
    try {
      const inventory = await this.getInventoryByProduct(productId);
      if (!inventory) {
        return [];
      }
      return await _db_1.db.query.inventoryBatches.findMany({
        _where: (0, drizzle_orm_1.eq)(schema.inventoryBatches.inventoryId, inventory.id),
        _orderBy: [(0, drizzle_orm_1.desc)(schema.inventoryBatches.receivedDate)]
      });
    }
    catch (err) {
      return this.handleError(err, 'getBatchesByProduct');
    }
  }
  async getLowStockItems(storeId) {
    try {
      const store = await _db_1.db.query.stores.findFirst({
        _where: (0, drizzle_orm_1.eq)(schema.stores.id, storeId)
      });
      if (!store)
        throw types_1.InventoryServiceErrors.STORE_NOT_FOUND;
      return await _db_1.db.query.inventory.findMany({
        _where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.inventory.storeId, storeId), (0, drizzle_orm_1.gt)(schema.inventory.quantity, 0), (0, drizzle_orm_1.gt)(schema.inventory.minStock, schema.inventory.quantity)),
        _orderBy: [(0, drizzle_orm_1.asc)(schema.inventory.quantity)]
      });
    }
    catch (err) {
      return this.handleError(err, 'getLowStockItems');
    }
  }
  async getInventoryValuation(storeId) {
    try {
      const store = await _db_1.db.query.stores.findFirst({
        _where: (0, drizzle_orm_1.eq)(schema.stores.id, storeId)
      });
      if (!store)
        throw types_1.InventoryServiceErrors.STORE_NOT_FOUND;
      const inventory = await _db_1.db.query.inventory.findMany({
        _where: (0, drizzle_orm_1.eq)(schema.inventory.storeId, storeId),
        _orderBy: [(0, drizzle_orm_1.desc)(schema.inventory.updatedAt)]
      });
      /* ---------- Valuation calc ---------- */
      let totalValue = 0;
      const byCategory = new Map();
      for (const inv of inventory) {
        const product = await _db_1.db.query.products.findFirst({
          _where: (0, drizzle_orm_1.eq)(schema.products.id, inv.productId)
        });
        if (!product)
          continue;
        const value = (inv.quantity ?? 0) * Number(product.cost || 0);
        totalValue += value;
        const catId = product.categoryId?.toString() ?? 'N/A';
        const catName = catId;
        if (!byCategory.has(catId)) {
          byCategory.set(catId, { _value: 0, _count: 0, _name: catName });
        }
        const bucket = byCategory.get(catId);
        bucket.value += value;
        bucket.count += inv.quantity ?? 0;
      }
      return {
        _totalValue: totalValue.toFixed(2),
        _totalItems: inventory.reduce((acc, inv) => acc + (inv.quantity ?? 0), 0),
        _valuationDate: new Date(),
        _breakdown: Array.from(byCategory.entries()).map(([categoryName, data]) => ({
          _categoryId: 0, // This is a placeholder, as we don't have a category ID.
          _categoryName: data.name,
          _value: data.value.toFixed(2),
          _itemCount: data.count
        }))
      };
    }
    catch (err) {
      return this.handleError(err, 'getInventoryValuation');
    }
  }
}
exports.InventoryService = InventoryService;
