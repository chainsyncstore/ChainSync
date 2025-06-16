import { storage } from '../storage';
// import * as schema from '@shared/schema'; // Unused
// import { db } from '@db'; // Unused
// import { eq, and, desc } from 'drizzle-orm'; // Unused

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
    // Check if inventory exists
    let inventory = await storage.getStoreProductInventory(
      batchData.storeId,
      batchData.productId
    );

    // Create inventory if it doesn't exist
    if (!inventory) {
      inventory = await storage.createInventory({
        storeId: batchData.storeId,
        productId: batchData.productId,
        totalQuantity: 0,
        minimumLevel: 5
      });
    }

    // Create batch
    const batch = await storage.createInventoryBatch({
      inventoryId: inventory.id,
      batchNumber: batchData.batchNumber,
      quantity: batchData.quantity,
      expiryDate: batchData.expiryDate || null,
      receivedDate: new Date().toISOString(),
      manufacturingDate: batchData.manufacturingDate || null,
      costPerUnit: batchData.costPerUnit?.toString() || null
    });

    // Update inventory total quantity
    await storage.updateInventoryTotalQuantity(inventory.id);
    
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
    return await storage.getInventoryBatchesByProduct(storeId, productId, includeExpired);
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
    return await storage.getInventoryBatchById(batchId);
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
    // Get the current batch to retrieve its inventory ID
    const currentBatch = await storage.getInventoryBatchById(batchId);
    if (!currentBatch) {
      throw new Error('Batch not found');
    }

    // Update batch
    await storage.updateInventoryBatch(batchId, updateData);

    // Update inventory total quantity
    await storage.updateInventoryTotalQuantity(currentBatch.inventoryId);

    return await storage.getInventoryBatchById(batchId);
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
    // Get the current batch
    const currentBatch = await storage.getInventoryBatchById(adjustment.batchId);
    if (!currentBatch) {
      throw new Error('Batch not found');
    }

    // Calculate new quantity
    const newQuantity = currentBatch.quantity + adjustment.quantity;
    
    // Ensure quantity doesn't go below zero
    if (newQuantity < 0) {
      throw new Error('Adjustment would result in negative stock');
    }

    // Update batch quantity
    await storage.updateInventoryBatch(adjustment.batchId, { 
      quantity: newQuantity 
    });

    // Update inventory total quantity
    await storage.updateInventoryTotalQuantity(currentBatch.inventoryId);

    // TODO: In a more advanced version, we would log this adjustment
    // with the reason in a stock_adjustments table

    return await storage.getInventoryBatchById(adjustment.batchId);
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
    // Get all non-expired batches for this product, ordered by expiry date (ascending)
    const batches = await storage.getInventoryBatchesByProduct(storeId, productId, false);
    
    // Sort batches by expiry date (closest expiry first)
    // Batches without expiry dates will go last
    const sortedBatches = batches.sort((a, b) => {
      if (!a.expiryDate && !b.expiryDate) return 0;
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
    });

    let remainingQty = quantity;
    const updatedBatches = [];

    // Iterate through batches to fulfill the quantity needed
    for (const batch of sortedBatches) {
      if (remainingQty <= 0) break;

      const qtyToSell = Math.min(batch.quantity, remainingQty);
      
      if (qtyToSell > 0) {
        // Sell from this batch
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