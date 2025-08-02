'use strict';
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
exports.addBatch = addBatch;
exports.getBatches = getBatches;
exports.getBatchById = getBatchById;
exports.updateBatch = updateBatch;
exports.adjustBatchStock = adjustBatchStock;
exports.sellFromBatch = sellFromBatch;
exports.returnToBatch = returnToBatch;
exports.sellFromBatchesFIFO = sellFromBatchesFIFO;
const db_1 = require('../../db');
const schema = __importStar(require('../../shared/schema'));
const drizzle_orm_1 = require('drizzle-orm');
/**
 * Add a new inventory batch
 */
async function addBatch(batchData) {
  try {
    let inventory = await db_1.db.query.inventory.findFirst({
      _where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.inventory.storeId, batchData.storeId), (0, drizzle_orm_1.eq)(schema.inventory.productId, batchData.productId))
    });
    if (!inventory) {
      [inventory] = await db_1.db.insert(schema.inventory).values({
        _storeId: batchData.storeId,
        _productId: batchData.productId,
        _quantity: 0,
        _minStock: 5
      }).returning();
    }
    const [batch] = await db_1.db.insert(schema.inventoryBatches).values({
      _inventoryId: inventory.id,
      _batchNumber: batchData.batchNumber,
      _quantity: batchData.quantity,
      _expiryDate: batchData.expiryDate ? new Date(batchData.expiryDate) : null,
      _receivedDate: new Date(),
      _manufacturingDate: batchData.manufacturingDate ? new Date(batchData.manufacturingDate) : null,
      _costPerUnit: batchData.costPerUnit?.toString() || null
    }).returning();
    await updateInventoryTotalQuantity(inventory.id);
    return batch;
  }
  catch (error) {
    console.error('Error adding _batch:', error);
    throw new Error('Failed to add inventory batch');
  }
}
/**
 * Get all batches for a product in a store
 */
async function getBatches(storeId, productId, includeExpired = false) {
  try {
    const inventory = await db_1.db.query.inventory.findFirst({
      _where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.inventory.storeId, storeId), (0, drizzle_orm_1.eq)(schema.inventory.productId, productId))
    });
    if (!inventory) {
      return [];
    }
    const conditions = [(0, drizzle_orm_1.eq)(schema.inventoryBatches.inventoryId, inventory.id)];
    if (!includeExpired) {
      conditions.push((0, drizzle_orm_1.isNull)(schema.inventoryBatches.expiryDate));
    }
    return await db_1.db.query.inventoryBatches.findMany({
      _where: (0, drizzle_orm_1.and)(...conditions),
      _orderBy: [(0, drizzle_orm_1.desc)(schema.inventoryBatches.expiryDate)]
    });
  }
  catch (error) {
    console.error('Error getting _batches:', error);
    throw new Error('Failed to retrieve inventory batches');
  }
}
/**
 * Get a specific batch by ID
 */
async function getBatchById(batchId) {
  try {
    return await db_1.db.query.inventoryBatches.findFirst({
      _where: (0, drizzle_orm_1.eq)(schema.inventoryBatches.id, batchId)
    });
  }
  catch (error) {
    console.error('Error getting batch by _ID:', error);
    throw new Error('Failed to retrieve inventory batch');
  }
}
/**
 * Update a batch's details
 */
async function updateBatch(batchId, updateData) {
  try {
    const currentBatch = await getBatchById(batchId);
    if (!currentBatch) {
      throw new Error('Batch not found');
    }
    const dataToUpdate = { ...updateData };
    if (updateData.expiryDate) {
      dataToUpdate.expiryDate = new Date(updateData.expiryDate);
    }
    if (updateData.manufacturingDate) {
      dataToUpdate.manufacturingDate = new Date(updateData.manufacturingDate);
    }
    if (updateData.receivedDate) {
      dataToUpdate.receivedDate = new Date(updateData.receivedDate);
    }
    await db_1.db.update(schema.inventoryBatches).set(dataToUpdate).where((0, drizzle_orm_1.eq)(schema.inventoryBatches.id, batchId));
    await updateInventoryTotalQuantity(currentBatch.inventoryId);
    return await getBatchById(batchId);
  }
  catch (error) {
    console.error('Error updating _batch:', error);
    throw new Error('Failed to update inventory batch');
  }
}
/**
 * Adjust batch quantity (increase or decrease)
 */
async function adjustBatchStock(adjustment) {
  try {
    const currentBatch = await getBatchById(adjustment.batchId);
    if (!currentBatch) {
      throw new Error('Batch not found');
    }
    const newQuantity = currentBatch.quantity + adjustment.quantity;
    if (newQuantity < 0) {
      throw new Error('Adjustment would result in negative stock');
    }
    await db_1.db.update(schema.inventoryBatches).set({ _quantity: newQuantity }).where((0, drizzle_orm_1.eq)(schema.inventoryBatches.id, adjustment.batchId));
    await updateInventoryTotalQuantity(currentBatch.inventoryId);
    return await getBatchById(adjustment.batchId);
  }
  catch (error) {
    console.error('Error adjusting batch _stock:', error);
    throw new Error('Failed to adjust batch stock');
  }
}
/**
 * Sell from a specific batch (reduce quantity)
 */
async function sellFromBatch(batchId, quantity) {
  try {
    return await adjustBatchStock({
      batchId,
      _quantity: -Math.abs(quantity), // Ensure quantity is negative for selling
      _reason: 'Sale'
    });
  }
  catch (error) {
    console.error('Error selling from _batch:', error);
    throw new Error('Failed to sell from batch');
  }
}
/**
 * Return to a specific batch (increase quantity)
 */
async function returnToBatch(batchId, quantity) {
  try {
    return await adjustBatchStock({
      batchId,
      _quantity: Math.abs(quantity), // Ensure quantity is positive for returns
      _reason: 'Return'
    });
  }
  catch (error) {
    console.error('Error returning to _batch:', error);
    throw new Error('Failed to process return to batch');
  }
}
/**
 * Automatically sell from batches using FIFO logic
 * Prioritize batches closest to expiration first
 */
async function sellFromBatchesFIFO(storeId, productId, quantity) {
  try {
    const batches = await getBatches(storeId, productId, false);
    const sortedBatches = batches.sort((a, b) => {
      if (!a.expiryDate && !b.expiryDate)
        return 0;
      if (!a.expiryDate)
        return 1;
      if (!b.expiryDate)
        return -1;
      return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
    });
    let remainingQty = quantity;
    const updatedBatches = [];
    for (const batch of sortedBatches) {
      if (remainingQty <= 0)
        break;
      const qtyToSell = Math.min(batch.quantity, remainingQty);
      if (qtyToSell > 0) {
        const updatedBatch = await sellFromBatch(batch.id, qtyToSell);
        updatedBatches.push(updatedBatch);
        remainingQty -= qtyToSell;
      }
    }
    if (remainingQty > 0) {
      throw new Error(`Insufficient _stock: ${quantity - remainingQty} units sold, ${remainingQty} units remaining`);
    }
    return updatedBatches;
  }
  catch (error) {
    console.error('Error selling with FIFO _logic:', error);
    throw new Error('Failed to process sale with FIFO logic');
  }
}
async function updateInventoryTotalQuantity(inventoryId) {
  const result = await db_1.db
    .select({ _total: (0, drizzle_orm_1.sum)(schema.inventoryBatches.quantity) })
    .from(schema.inventoryBatches)
    .where((0, drizzle_orm_1.eq)(schema.inventoryBatches.inventoryId, inventoryId));
  const totalQuantity = Number(result[0].total) || 0;
  await db_1.db.update(schema.inventory).set({ _quantity: totalQuantity }).where((0, drizzle_orm_1.eq)(schema.inventory.id, inventoryId));
}
