import { storage } from "../storage";
import * as schema from "@shared/schema";

/**
 * Handles selling items using FIFO (First In, First Out) approach
 * This ensures that the items with the soonest expiry dates are sold first
 */
export async function sellProductFromBatches(
  storeId: number, 
  productId: number, 
  quantity: number,
  operationDate = new Date()
): Promise<{
  success: boolean;
  message?: string;
  batchesSold?: Array<{batchId: number, quantity: number, expiryDate?: Date | null}>
}> {
  try {
    // Get inventory and associated batches
    const inventory = await storage.getStoreProductInventory(storeId, productId);
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
    
    // Get all non-expired batches sorted by expiry date (FIFO)
    const batches = await storage.getInventoryBatchesByProduct(storeId, productId, false);
    
    // Check for expired batches that would block the sale
    const expiredBatches = batches.filter(batch => {
      if (!batch.expiryDate) return false;
      return new Date(batch.expiryDate) < operationDate;
    });
    
    if (expiredBatches.length > 0 && expiredBatches.some(b => b.quantity > 0)) {
      return {
        success: false,
        message: "Cannot sell expired products. Please remove expired batches from inventory."
      };
    }
    
    const validBatches = batches.filter(batch => {
      if (!batch.expiryDate) return true;
      return new Date(batch.expiryDate) >= operationDate;
    });
    
    // Sort by expiry date (null dates at the end)
    validBatches.sort((a, b) => {
      if (!a.expiryDate && !b.expiryDate) return 0;
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
    });
    
    let remainingQuantity = quantity;
    const batchesSold: Array<{batchId: number, quantity: number, expiryDate?: Date | null}> = [];
    
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
    console.error("Error in sellProductFromBatches:", error);
    return {
      success: false,
      message: "Internal server error while processing inventory batches"
    };
  }
}

/**
 * Handles returning items to inventory by adding to existing batches or creating new batches
 */
export async function returnProductToBatches(
  storeId: number,
  productId: number,
  quantity: number,
  batchId?: number,
  expiryDate?: Date
): Promise<{
  success: boolean;
  message?: string;
  batch?: schema.InventoryBatch;
}> {
  try {
    // Get inventory
    const inventory = await storage.getStoreProductInventory(storeId, productId);
    if (!inventory) {
      return {
        success: false,
        message: "Product not found in inventory"
      };
    }
    
    // If a specific batch ID is provided, add the quantity back to that batch
    if (batchId) {
      const batch = await storage.getInventoryBatchById(batchId);
      
      if (!batch || batch.inventoryId !== inventory.id) {
        return {
          success: false,
          message: "Specified batch not found or doesn't belong to this product"
        };
      }
      
      // Add quantity back to batch
      const updatedBatch = await storage.updateInventoryBatch(batchId, {
        quantity: batch.quantity + quantity
      });
      
      return {
        success: true,
        batch: updatedBatch
      };
    }
    
    // If no batch ID provided, create a new batch
    const newBatch = await storage.createInventoryBatch({
      inventoryId: inventory.id,
      batchNumber: `RETURN-${Date.now()}`,
      quantity,
      expiryDate,
      receivedDate: new Date()
    });
    
    return {
      success: true,
      batch: newBatch
    };
  } catch (error) {
    console.error("Error in returnProductToBatches:", error);
    return {
      success: false,
      message: "Internal server error while processing inventory batches"
    };
  }
}