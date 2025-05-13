import * as schema from "@shared/schema";
import { storage } from "../storage";
import { v4 as uuidv4 } from "uuid";

/**
 * Generate a unique refund ID
 */
export function generateRefundId(): string {
  return `REF-${uuidv4().substring(0, 8).toUpperCase()}`;
}

/**
 * Process a refund for a transaction
 * Handles perishable and imperishable items differently:
 * - Perishable items: Account for loss (doesn't add back to inventory)
 * - Imperishable items: Restock to inventory
 */
export async function processRefund(
  transactionId: number,
  storeId: number,
  processedById: number,
  items: Array<{
    transactionItemId: number;
    quantity: number;
    reason: string;
  }>,
  refundMethod: string = "cash"
): Promise<schema.Refund> {
  try {
    // Get the original transaction
    const transaction = await storage.getTransactionById(transactionId);
    if (!transaction) {
      throw new Error(`Transaction not found with ID: ${transactionId}`);
    }

    // Validate items quantities against original transaction items
    const validatedItems: schema.RefundItemInsert[] = await Promise.all(
      items.map(async (item) => {
        // Find the transaction item
        const transactionItem = transaction.items.find(
          (ti) => ti.id === item.transactionItemId
        );

        if (!transactionItem) {
          throw new Error(
            `Transaction item not found with ID: ${item.transactionItemId}`
          );
        }

        // Check if quantity is valid (not more than what was purchased minus what was already returned)
        const availableForReturn =
          transactionItem.quantity - transactionItem.returnedQuantity;
        if (item.quantity <= 0 || item.quantity > availableForReturn) {
          throw new Error(
            `Invalid quantity for refund: ${item.quantity}. Available: ${availableForReturn}`
          );
        }

        // Calculate refund amount
        const subtotal = Number(transactionItem.unitPrice) * item.quantity;

        return {
          transactionItemId: item.transactionItemId,
          productId: transactionItem.productId,
          quantity: item.quantity,
          unitPrice: transactionItem.unitPrice,
          subtotal: subtotal.toString(),
          isRestocked: false, // Will be updated during processing for non-perishable items
        };
      })
    );

    // Calculate totals
    const subtotal = validatedItems.reduce(
      (sum, item) => sum + Number(item.subtotal),
      0
    );
    
    // Calculate tax based on original transaction tax rate
    const originalTaxRate = Number(transaction.tax) / Number(transaction.subtotal);
    const tax = subtotal * originalTaxRate;
    const total = subtotal + tax;

    // Create refund data
    const refundData: schema.RefundInsert = {
      refundId: generateRefundId(),
      transactionId: transaction.id,
      storeId,
      processedById,
      subtotal: subtotal.toString(),
      tax: tax.toString(),
      total: total.toString(),
      refundMethod,
      reason: items.map(item => item.reason).filter(Boolean).join(", ") || "Customer return",
      status: "completed",
    };

    // Process the refund with inventory updates
    const result = await storage.createRefund(refundData, validatedItems);
    return result.refund;
  } catch (error) {
    console.error("Error processing refund:", error);
    throw error;
  }
}

/**
 * Get refund details by ID
 */
export async function getRefundById(refundId: number): Promise<schema.Refund | null> {
  try {
    return await storage.getRefundById(refundId);
  } catch (error) {
    console.error(`Error getting refund with ID ${refundId}:`, error);
    throw error;
  }
}

/**
 * Get all refunds for a transaction
 */
export async function getRefundsByTransactionId(
  transactionId: number
): Promise<schema.Refund[]> {
  try {
    return await storage.getRefundsByTransactionId(transactionId);
  } catch (error) {
    console.error(`Error getting refunds for transaction ${transactionId}:`, error);
    throw error;
  }
}

/**
 * Get refunds for a store with optional date filtering and pagination
 */
export async function getStoreRefunds(
  storeId: number,
  startDate?: Date,
  endDate?: Date,
  page: number = 1,
  limit: number = 20
): Promise<schema.Refund[]> {
  try {
    return await storage.getStoreRefunds(storeId, startDate, endDate, page, limit);
  } catch (error) {
    console.error(`Error getting refunds for store ${storeId}:`, error);
    throw error;
  }
}

/**
 * Get total count of refunds
 */
export async function getRefundCount(
  storeId?: number,
  startDate?: Date,
  endDate?: Date
): Promise<number> {
  try {
    return await storage.getRefundCount(storeId, startDate, endDate);
  } catch (error) {
    console.error("Error getting refund count:", error);
    throw error;
  }
}