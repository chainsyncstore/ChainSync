import { db } from '../../db/index.js';
import * as schema from '../../shared/schema.js';
import { eq, and, desc, sum, isNull } from 'drizzle-orm';

export interface BatchInsertData {
  inventoryId: number;
  batchNumber: string;
  quantity: number;
  expiryDate: string | null;
  receivedDate: string;
  manufacturingDate: string | null;
  costPerUnit: string | null;
}

export interface BatchStockAdjustment {
  batchId: number;
  quantity: number;
  reason: string;
}

export interface BatchData {
  id?: number;
  storeId: number;
  productId: number;
  batchNumber: string;
  quantity: number;
  expiryDate?: string | null;
  manufacturingDate?: string | null;
  costPerUnit?: string | null;
}

/**
 * Add a new inventory batch
 */
export async function addBatch(batchData: BatchData) {
  try {
    let inventory = await db.query.inventory.findFirst({
      where: and(eq(schema.inventory.storeId, batchData.storeId), eq(schema.inventory.productId, batchData.productId)),
    });

    if (!inventory) {
      [inventory] = await db.insert(schema.inventory).values({
        storeId: batchData.storeId,
        productId: batchData.productId,
        quantity: 0,
        minStock: 5,
      }).returning();
    }

    const [batch] = await db.insert(schema.inventoryBatches).values({
      inventoryId: inventory.id,
      batchNumber: batchData.batchNumber,
      quantity: batchData.quantity,
      expiryDate: batchData.expiryDate ? new Date(batchData.expiryDate) : null,
      receivedDate: new Date(),
      manufacturingDate: batchData.manufacturingDate ? new Date(batchData.manufacturingDate) : null,
      costPerUnit: batchData.costPerUnit?.toString() || null,
    }).returning();

    await updateInventoryTotalQuantity(inventory.id);
    
    return batch;
  } catch (error) {
    console.error('Error adding batch:', error);
    throw new Error('Failed to add inventory batch');
  }
}

/**
 * Get all batches for a product in a store
 */
export async function getBatches(storeId: number, productId: number, includeExpired = false) {
  try {
    const inventory = await db.query.inventory.findFirst({
      where: and(eq(schema.inventory.storeId, storeId), eq(schema.inventory.productId, productId)),
    });

    if (!inventory) {
      return [];
    }

    const conditions = [eq(schema.inventoryBatches.inventoryId, inventory.id)];
    if (!includeExpired) {
      conditions.push(isNull(schema.inventoryBatches.expiryDate));
    }

    return await db.query.inventoryBatches.findMany({
      where: and(...conditions),
      orderBy: [desc(schema.inventoryBatches.expiryDate)],
    });
  } catch (error) {
    console.error('Error getting batches:', error);
    throw new Error('Failed to retrieve inventory batches');
  }
}

/**
 * Get a specific batch by ID
 */
export async function getBatchById(batchId: number) {
  try {
    return await db.query.inventoryBatches.findFirst({
      where: eq(schema.inventoryBatches.id, batchId),
    });
  } catch (error) {
    console.error('Error getting batch by ID:', error);
    throw new Error('Failed to retrieve inventory batch');
  }
}

/**
 * Update a batch's details
 */
export async function updateBatch(batchId: number, updateData: Partial<BatchInsertData>) {
  try {
    const currentBatch = await getBatchById(batchId);
    if (!currentBatch) {
      throw new Error('Batch not found');
    }

    const dataToUpdate: any = { ...updateData };
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
    console.error('Error updating batch:', error);
    throw new Error('Failed to update inventory batch');
  }
}

/**
 * Adjust batch quantity (increase or decrease)
 */
export async function adjustBatchStock(adjustment: BatchStockAdjustment) {
  try {
    const currentBatch = await getBatchById(adjustment.batchId);
    if (!currentBatch) {
      throw new Error('Batch not found');
    }

    const newQuantity = currentBatch.quantity + adjustment.quantity;
    
    if (newQuantity < 0) {
      throw new Error('Adjustment would result in negative stock');
    }

    await db.update(schema.inventoryBatches).set({ quantity: newQuantity }).where(eq(schema.inventoryBatches.id, adjustment.batchId));

    await updateInventoryTotalQuantity(currentBatch.inventoryId);

    return await getBatchById(adjustment.batchId);
  } catch (error) {
    console.error('Error adjusting batch stock:', error);
    throw new Error('Failed to adjust batch stock');
  }
}

/**
 * Sell from a specific batch (reduce quantity)
 */
export async function sellFromBatch(batchId: number, quantity: number) {
  try {
    return await adjustBatchStock({
      batchId,
      quantity: -Math.abs(quantity), // Ensure quantity is negative for selling
      reason: 'Sale'
    });
  } catch (error) {
    console.error('Error selling from batch:', error);
    throw new Error('Failed to sell from batch');
  }
}

/**
 * Return to a specific batch (increase quantity)
 */
export async function returnToBatch(batchId: number, quantity: number) {
  try {
    return await adjustBatchStock({
      batchId,
      quantity: Math.abs(quantity), // Ensure quantity is positive for returns
      reason: 'Return'
    });
  } catch (error) {
    console.error('Error returning to batch:', error);
    throw new Error('Failed to process return to batch');
  }
}

/**
 * Automatically sell from batches using FIFO logic
 * Prioritize batches closest to expiration first
 */
export async function sellFromBatchesFIFO(storeId: number, productId: number, quantity: number) {
  try {
    const batches = await getBatches(storeId, productId, false);
    
    const sortedBatches = batches.sort((a: any, b: any) => {
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
      throw new Error(`Insufficient stock: ${quantity - remainingQty} units sold, ${remainingQty} units remaining`);
    }

    return updatedBatches;
  } catch (error) {
    console.error('Error selling with FIFO logic:', error);
    throw new Error('Failed to process sale with FIFO logic');
  }
}

async function updateInventoryTotalQuantity(inventoryId: number) {
  const result = await db
    .select({ total: sum(schema.inventoryBatches.quantity) })
    .from(schema.inventoryBatches)
    .where(eq(schema.inventoryBatches.inventoryId, inventoryId));

  const totalQuantity = Number(result[0].total) || 0;

  await db.update(schema.inventory).set({ quantity: totalQuantity }).where(eq(schema.inventory.id, inventoryId));
}
