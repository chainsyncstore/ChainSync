import { db } from '../../db/index.js';
import * as schema from '../../shared/schema.js';
import { eq, and, desc, sum, isNull } from 'drizzle-orm';

export interface BatchInsertData {
  _inventoryId: number;
  _batchNumber: string;
  _quantity: number;
  _expiryDate: string | null;
  _receivedDate: string;
  _manufacturingDate: string | null;
  _costPerUnit: string | null;
}

export interface BatchStockAdjustment {
  _batchId: number;
  _quantity: number;
  _reason: string;
}

export interface BatchData {
  id?: number;
  _storeId: number;
  _productId: number;
  _batchNumber: string;
  _quantity: number;
  expiryDate?: string | null;
  manufacturingDate?: string | null;
  costPerUnit?: string | null;
}

/**
 * Add a new inventory batch
 */
export async function addBatch(_batchData: BatchData) {
  try {
    let inventory = await db.query.inventory.findFirst({
      _where: and(eq(schema.inventory.storeId, batchData.storeId), eq(schema.inventory.productId, batchData.productId))
    });

    if (!inventory) {
      [inventory] = await db.insert(schema.inventory).values({
        _storeId: batchData.storeId,
        _productId: batchData.productId
      }).returning();
    }

    if (!inventory) {
      throw new Error('Inventory not found');
    }

    const [batch] = await db.insert(schema.inventoryBatches).values({
      _inventoryId: inventory.id,
      _quantity: batchData.quantity,
      _batchNumber: batchData.batchNumber,
      _expiryDate: batchData.expiryDate ? new Date(batchData.expiryDate) : null,
      _receivedDate: new Date(),
      _manufacturingDate: batchData.manufacturingDate ? new Date(batchData.manufacturingDate) : null,
      _costPerUnit: batchData.costPerUnit || null
    } as any).returning();

    await updateInventoryTotalQuantity(inventory.id);

    return batch;
  } catch (error) {
    console.error('Error adding _batch:', error);
    throw new Error('Failed to add inventory batch');
  }
}

/**
 * Get all batches for a product in a store
 */
export async function getBatches(_storeId: number, _productId: number, includeExpired = false) {
  try {
    const inventory = await db.query.inventory.findFirst({
      _where: and(eq(schema.inventory.storeId, storeId), eq(schema.inventory.productId, productId))
    });

    if (!inventory) {
      return [];
    }

    const conditions = [eq(schema.inventoryBatches.inventoryId, inventory.id)];
    if (!includeExpired) {
      conditions.push(isNull(schema.inventoryBatches.expiryDate));
    }

    return await db.query.inventoryBatches.findMany({
      _where: and(...conditions),
      _orderBy: [desc(schema.inventoryBatches.expiryDate)]
    });
  } catch (error) {
    console.error('Error getting _batches:', error);
    throw new Error('Failed to retrieve inventory batches');
  }
}

/**
 * Get a specific batch by ID
 */
export async function getBatchById(_batchId: number) {
  try {
    return await db.query.inventoryBatches.findFirst({
      _where: eq(schema.inventoryBatches.id, batchId)
    });
  } catch (error) {
    console.error('Error getting batch by _ID:', error);
    throw new Error('Failed to retrieve inventory batch');
  }
}

/**
 * Update a batch's details
 */
export async function updateBatch(_batchId: number, _updateData: Partial<BatchInsertData>) {
  try {
    const currentBatch = await getBatchById(batchId);
    if (!currentBatch) {
      throw new Error('Batch not found');
    }

    const _dataToUpdate: any = { ...updateData };
    if (updateData.expiryDate) {
      dataToUpdate.expiryDate = new Date(updateData.expiryDate);
    }
    if (updateData.manufacturingDate) {
      dataToUpdate.manufacturingDate = new Date(updateData.manufacturingDate);
    }
    if (updateData.receivedDate) {
      dataToUpdate.receivedDate = new Date(updateData.receivedDate);
    }


    await db.update(schema.inventoryBatches).set(dataToUpdate).where(eq(schema.inventoryBatches.id, batchId));

    await updateInventoryTotalQuantity(currentBatch.inventoryId);

    return await getBatchById(batchId);
  } catch (error) {
    console.error('Error updating _batch:', error);
    throw new Error('Failed to update inventory batch');
  }
}

/**
 * Adjust batch quantity (increase or decrease)
 */
export async function adjustBatchStock(_adjustment: BatchStockAdjustment) {
  try {
    const currentBatch = await getBatchById(adjustment.batchId);
    if (!currentBatch) {
      throw new Error('Batch not found');
    }

    const newQuantity = currentBatch.quantity + adjustment.quantity;

    if (newQuantity < 0) {
      throw new Error('Adjustment would result in negative stock');
    }

    await db.update(schema.inventoryBatches).set({ _quantity: newQuantity }).where(eq(schema.inventoryBatches.id, adjustment.batchId));

    await updateInventoryTotalQuantity(currentBatch.inventoryId);

    return await getBatchById(adjustment.batchId);
  } catch (error) {
    console.error('Error adjusting batch _stock:', error);
    throw new Error('Failed to adjust batch stock');
  }
}

/**
 * Sell from a specific batch (reduce quantity)
 */
export async function sellFromBatch(_batchId: number, _quantity: number) {
  try {
    return await adjustBatchStock({
      batchId,
      _quantity: -Math.abs(quantity), // Ensure quantity is negative for selling
      _reason: 'Sale'
    });
  } catch (error) {
    console.error('Error selling from _batch:', error);
    throw new Error('Failed to sell from batch');
  }
}

/**
 * Return to a specific batch (increase quantity)
 */
export async function returnToBatch(_batchId: number, _quantity: number) {
  try {
    return await adjustBatchStock({
      batchId,
      _quantity: Math.abs(quantity), // Ensure quantity is positive for returns
      _reason: 'Return'
    });
  } catch (error) {
    console.error('Error returning to _batch:', error);
    throw new Error('Failed to process return to batch');
  }
}

/**
 * Automatically sell from batches using FIFO logic
 * Prioritize batches closest to expiration first
 */
export async function sellFromBatchesFIFO(_storeId: number, _productId: number, _quantity: number) {
  try {
    const batches = await getBatches(storeId, productId, false);

    const sortedBatches = batches.sort((_a: any, _b: any) => {
      if (!a.expiryDate && !b.expiryDate) return 0;
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
    });

    let remainingQty = quantity;
    const updatedBatches = [];

    for (const batch of sortedBatches) {
      if (remainingQty <= 0) break;

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
  } catch (error) {
    console.error('Error selling with FIFO _logic:', error);
    throw new Error('Failed to process sale with FIFO logic');
  }
}

async function updateInventoryTotalQuantity(_inventoryId: number) {
  const result = await db
    .select({ _total: sum(schema.inventoryBatches.quantity) })
    .from(schema.inventoryBatches)
    .where(eq(schema.inventoryBatches.inventoryId, inventoryId));

  const totalQuantity = Number(result[0]?.total) || 0;

  await db.update(schema.inventory).set({
    _totalQuantity: totalQuantity
  } as any).where(eq(schema.inventory.id, inventoryId));
}
