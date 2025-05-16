import { db } from "../../db";
import * as schema from "@shared/schema";
import { and, eq, gt, gte, isNull, lt, lte, or } from "drizzle-orm";
import { storage } from "../storage";

/**
 * Helper service for managing batch-level inventory
 * This allows tracking different batches of the same product with different expiry dates
 */

/**
 * Add a new batch of inventory for a product
 */
export async function addInventoryBatch(
  storeId: number,
  productId: number,
  batchData: {
    batchNumber: string;
    quantity: number;
    expiryDate?: Date | null;
    manufacturingDate?: Date | null;
    costPerUnit?: number;
  }
) {
  try {
    // Get the inventory item for this product at this store
    let inventory = await storage.getStoreProductInventory(storeId, productId);

    // If no inventory record exists, create one
    if (!inventory) {
      const product = await storage.getProductById(productId);
      if (!product) {
        throw new Error(`Product with ID ${productId} not found`);
      }

      const store = await storage.getStoreById(storeId);
      if (!store) {
        throw new Error(`Store with ID ${storeId} not found`);
      }

      // Create a new inventory record
      inventory = await storage.createInventory({
        storeId,
        productId,
        totalQuantity: 0,
        minimumLevel: 10 // Default minimum level
      });
    }

    // Create the new batch
    const batch = await storage.createInventoryBatch({
      inventoryId: inventory.id,
      batchNumber: batchData.batchNumber,
      quantity: batchData.quantity,
      expiryDate: batchData.expiryDate,
      manufacturingDate: batchData.manufacturingDate,
      costPerUnit: batchData.costPerUnit,
      receivedDate: new Date()
    });

    // Get the updated inventory record
    const updatedInventory = await storage.getInventoryItemById(inventory.id);

    return {
      batch,
      inventory: updatedInventory
    };
  } catch (error) {
    console.error("Error adding inventory batch:", error);
    throw error;
  }
}

/**
 * Get all batches for a product at a store
 */
export async function getProductBatches(
  storeId: number,
  productId: number,
  includeExpired: boolean = false
) {
  try {
    // Get the inventory record
    const inventory = await storage.getStoreProductInventory(storeId, productId);
    
    if (!inventory) {
      return {
        inventory: null,
        batches: []
      };
    }
    
    // Get all batches for this inventory
    let batches = await db.query.inventoryBatches.findMany({
      where: eq(schema.inventoryBatches.inventoryId, inventory.id)
    });
    
    // Filter out expired batches if needed
    if (!includeExpired) {
      const today = new Date();
      batches = batches.filter(batch => {
        if (!batch.expiryDate) return true;
        return new Date(batch.expiryDate) > today;
      });
    }
    
    // Sort by expiry date (soonest first)
    batches.sort((a, b) => {
      if (!a.expiryDate && !b.expiryDate) return 0;
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
    });
    
    return {
      inventory,
      batches
    };
  } catch (error) {
    console.error("Error getting product batches:", error);
    throw error;
  }
}

/**
 * Sell a specified quantity of a product from inventory using FIFO
 * (First In, First Out) to prioritize batches with the soonest expiry dates
 */
export async function sellProductFromBatches(
  storeId: number,
  productId: number,
  quantity: number
) {
  try {
    // Get the inventory record with batches
    const { inventory, batches } = await getProductBatches(storeId, productId);
    
    if (!inventory) {
      return {
        success: false,
        message: "Product not found in inventory"
      };
    }
    
    // Check if we have enough total quantity
    if (inventory.totalQuantity < quantity) {
      return {
        success: false,
        message: `Insufficient inventory. Required: ${quantity}, Available: ${inventory.totalQuantity}`
      };
    }
    
    // Check for expired batches that would block the sale
    const expiredBatches = batches.filter(batch => {
      if (!batch.expiryDate) return false;
      return new Date(batch.expiryDate) < new Date();
    });
    
    if (expiredBatches.length > 0 && expiredBatches.some(b => b.quantity > 0)) {
      return {
        success: false,
        message: "Cannot sell expired products. Please remove expired batches from inventory."
      };
    }
    
    // Sort by expiry date (null dates at the end)
    const validBatches = batches.filter(batch => {
      if (!batch.expiryDate) return true;
      return new Date(batch.expiryDate) >= new Date();
    });
    
    validBatches.sort((a, b) => {
      if (!a.expiryDate && !b.expiryDate) return 0;
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
    });
    
    let remainingQuantity = quantity;
    const batchesSold = [];
    
    // Go through batches in order of expiry date (FIFO)
    for (const batch of validBatches) {
      if (remainingQuantity <= 0) break;
      
      // Calculate how much to take from this batch
      const quantityFromBatch = Math.min(batch.quantity, remainingQuantity);
      
      if (quantityFromBatch > 0) {
        // Update batch quantity
        await storage.updateInventoryBatch(batch.id, {
          quantity: batch.quantity - quantityFromBatch
        });
        
        batchesSold.push({
          batchId: batch.id,
          quantity: quantityFromBatch,
          expiryDate: batch.expiryDate
        });
        
        remainingQuantity -= quantityFromBatch;
      }
    }
    
    // If we couldn't sell the full quantity, this is a logic error
    if (remainingQuantity > 0) {
      // Rollback all batch modifications
      for (const soldItem of batchesSold) {
        const batch = await storage.getInventoryBatchById(soldItem.batchId);
        if (batch) {
          await storage.updateInventoryBatch(batch.id, {
            quantity: batch.quantity + soldItem.quantity
          });
        }
      }
      
      return {
        success: false,
        message: "Failed to allocate product quantity from available batches. Please check inventory."
      };
    }
    
    return {
      success: true,
      batchesSold
    };
  } catch (error) {
    console.error("Error selling product from batches:", error);
    return {
      success: false,
      message: "Error processing inventory: " + error.message
    };
  }
}

/**
 * Return a product to inventory, either to an existing batch or a new batch
 */
export async function returnProductToBatch(
  storeId: number,
  productId: number,
  quantity: number,
  options?: {
    batchId?: number;
    expiryDate?: Date;
    batchNumber?: string;
  }
) {
  try {
    // Get the inventory record
    const inventory = await storage.getStoreProductInventory(storeId, productId);
    
    if (!inventory) {
      // Need to create a new inventory record
      const product = await storage.getProductById(productId);
      if (!product) {
        return {
          success: false,
          message: "Product not found"
        };
      }
      
      const store = await storage.getStoreById(storeId);
      if (!store) {
        return {
          success: false,
          message: "Store not found"
        };
      }
      
      // Create new inventory record
      const newInventory = await storage.createInventory({
        storeId,
        productId,
        totalQuantity: 0,
        minimumLevel: 10
      });
      
      // Create new batch
      const batchNumber = options?.batchNumber || `RETURN-${Date.now()}`;
      const newBatch = await storage.createInventoryBatch({
        inventoryId: newInventory.id,
        batchNumber,
        quantity,
        expiryDate: options?.expiryDate,
        receivedDate: new Date()
      });
      
      return {
        success: true,
        inventory: await storage.getInventoryItemById(newInventory.id),
        batch: newBatch
      };
    }
    
    // If a specific batch ID is provided, add the quantity back to that batch
    if (options?.batchId) {
      const batch = await storage.getInventoryBatchById(options.batchId);
      
      if (!batch || batch.inventoryId !== inventory.id) {
        return {
          success: false,
          message: "Specified batch not found or doesn't belong to this product"
        };
      }
      
      // Add quantity back to batch
      const updatedBatch = await storage.updateInventoryBatch(batch.id, {
        quantity: batch.quantity + quantity
      });
      
      return {
        success: true,
        inventory: await storage.getInventoryItemById(inventory.id),
        batch: updatedBatch
      };
    }
    
    // If no batch ID provided, create a new batch
    const batchNumber = options?.batchNumber || `RETURN-${Date.now()}`;
    const newBatch = await storage.createInventoryBatch({
      inventoryId: inventory.id,
      batchNumber,
      quantity,
      expiryDate: options?.expiryDate,
      receivedDate: new Date()
    });
    
    return {
      success: true,
      inventory: await storage.getInventoryItemById(inventory.id),
      batch: newBatch
    };
  } catch (error) {
    console.error("Error returning product to batch:", error);
    return {
      success: false,
      message: "Error processing inventory return: " + error.message
    };
  }
}