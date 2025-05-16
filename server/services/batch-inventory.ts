import { db } from "../../db";
import * as schema from "@shared/schema";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { storage } from "../storage";

/**
 * Handles selling items using FIFO (First In, First Out) approach
 * This ensures that the items with the soonest expiry dates are sold first
 */
export async function sellProductFromBatches(
  storeId: number,
  productId: number, 
  quantity: number
): Promise<{ success: boolean; message?: string; batchesSold?: any[] }> {
  try {
    // Get the inventory item
    const inventory = await storage.getStoreProductInventory(storeId, productId);
    
    if (!inventory) {
      return {
        success: false,
        message: `Product not found in store inventory`
      };
    }
    
    // Check if there's enough total quantity
    if (inventory.totalQuantity < quantity) {
      return {
        success: false,
        message: `Not enough inventory. Required: ${quantity}, Available: ${inventory.totalQuantity}`
      };
    }

    // Get all batches for this product in this store
    const batches = await storage.getInventoryBatchesByProduct(storeId, productId);
    
    // Sort batches by expiry date (FIFO - soonest expiry first)
    const sortedBatches = [...batches].sort((a, b) => {
      // Non-expired batches first
      if (!a.expiryDate && !b.expiryDate) return 0;
      if (!a.expiryDate) return 1; // Items without expiry date go last
      if (!b.expiryDate) return -1;
      
      // Sort by expiry date
      return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
    });

    // Filter out expired batches
    const today = new Date();
    const validBatches = sortedBatches.filter(batch => {
      if (!batch.expiryDate) return true;
      return new Date(batch.expiryDate) >= today;
    });

    if (validBatches.length === 0) {
      return {
        success: false,
        message: "No valid inventory batches available"
      };
    }

    // Allocate quantity from batches
    let remainingQuantity = quantity;
    const batchSales = [];

    for (const batch of validBatches) {
      if (remainingQuantity <= 0) break;
      
      const quantityFromBatch = Math.min(batch.quantity, remainingQuantity);
      
      if (quantityFromBatch > 0) {
        // Update batch quantity
        await storage.updateInventoryBatch(batch.id, {
          quantity: batch.quantity - quantityFromBatch
        });
        
        batchSales.push({
          batchId: batch.id,
          quantity: quantityFromBatch,
          batchNumber: batch.batchNumber,
          expiryDate: batch.expiryDate
        });
        
        remainingQuantity -= quantityFromBatch;
      }
    }

    // If we weren't able to allocate all quantity, rollback
    if (remainingQuantity > 0) {
      // Revert all the batch quantity changes
      for (const sale of batchSales) {
        const batch = await storage.getInventoryBatchById(sale.batchId);
        if (batch) {
          await storage.updateInventoryBatch(batch.id, {
            quantity: batch.quantity + sale.quantity
          });
        }
      }
      
      return {
        success: false,
        message: `Could not allocate full quantity from available batches. Please check inventory.`
      };
    }

    return {
      success: true,
      batchesSold: batchSales
    };
  } catch (error) {
    console.error(`Error selling product from batches:`, error);
    return {
      success: false,
      message: `Error processing inventory: ${error.message}`
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
  expiryDate?: Date
): Promise<{ success: boolean; message?: string; batchId?: number }> {
  try {
    // Check if the product exists
    const product = await storage.getProductById(productId);
    if (!product) {
      return {
        success: false,
        message: `Product with ID ${productId} not found`
      };
    }

    // Get or create inventory record
    let inventory = await storage.getStoreProductInventory(storeId, productId);
    
    if (!inventory) {
      // Create a new inventory record
      inventory = await storage.createInventory({
        storeId,
        productId,
        totalQuantity: 0,
        minimumLevel: 10 // Default value
      });
    }

    // Create a new batch for the returned items
    const batchNumber = `RETURN-${Date.now()}`;
    const batch = await storage.createInventoryBatch({
      inventoryId: inventory.id,
      batchNumber,
      quantity,
      expiryDate,
      receivedDate: new Date()
    });

    return {
      success: true,
      batchId: batch.id
    };
  } catch (error) {
    console.error(`Error returning product to inventory:`, error);
    return {
      success: false,
      message: `Error processing return: ${error.message}`
    };
  }
}