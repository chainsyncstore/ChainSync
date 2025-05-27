import { db } from '../../../db';
import { withTransaction } from '../../../db/transaction';
import { getCachedOrFetch, generateEntityCacheKey, invalidateEntityCache } from '../../../src/cache/cache-strategy';
import { retry } from '../../utils/retry';
import { CircuitBreaker } from '../../utils/fallback';
import { ResilientHttpClient } from '../../utils/resilient-http-client';
import { getLogger } from '../../../src/logging';
import { schema, inventory, inventoryBatches, reorderRequests } from '../../../shared/db';
import { and, eq, lessOrEqual, greaterThan } from 'drizzle-orm';

const logger = getLogger().child({ component: 'resilient-inventory-service' });

/**
 * Supplier API service for ordering products
 */
class SupplierApiService {
  private client: ResilientHttpClient;
  private circuitBreaker: CircuitBreaker;

  constructor() {
    // Initialize the HTTP client with resilience features
    this.client = new ResilientHttpClient({
      baseURL: process.env.SUPPLIER_API_URL || 'https://api.suppliers.example.com',
      timeout: 5000,
      retry: {
        maxAttempts: 3,
        initialDelayMs: 500,
      },
      fallbackBaseURLs: [
        process.env.SUPPLIER_API_FALLBACK_URL,
      ].filter(Boolean) as string[],
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.SUPPLIER_API_KEY || '',
      },
    });

    // Create a separate circuit breaker for batch operations
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 60000,
      operationName: 'supplier-batch-api',
    });
  }

  /**
   * Check product availability from supplier
   */
  async checkAvailability(productId: string): Promise<{
    available: boolean;
    quantity: number;
    estimatedDeliveryDays: number;
  }> {
    try {
      return await this.client.get(`/products/${productId}/availability`);
    } catch (error) {
      logger.error('Failed to check product availability', { productId, error });
      // Return a safe default when the API is unavailable
      return {
        available: false,
        quantity: 0,
        estimatedDeliveryDays: 14, // Default to 2 weeks
      };
    }
  }

  /**
   * Place an order with the supplier
   */
  async placeOrder(orderData: any): Promise<{ orderId: string; status: string }> {
    return this.client.post('/orders', orderData);
  }

  /**
   * Get order status from supplier
   */
  async getOrderStatus(orderId: string): Promise<{ status: string; trackingNumber?: string }> {
    return this.client.get(`/orders/${orderId}`);
  }

  /**
   * Process a batch of inventory updates using circuit breaker pattern
   */
  async processBatchUpdates(updates: any[]): Promise<any[]> {
    return this.circuitBreaker.execute(async () => {
      return this.client.post('/inventory/batch-update', { updates });
    });
  }
}

/**
 * Resilient Inventory Service with built-in reliability features
 */
export class ResilientInventoryService {
  private supplierApi: SupplierApiService;

  constructor() {
    this.supplierApi = new SupplierApiService();
  }

  /**
   * Get inventory details with caching and fallback
   */
  async getInventoryItem(inventoryId: number, storeId: number): Promise<any> {
    const cacheKey = generateEntityCacheKey('INVENTORY' as any, `${storeId}:${inventoryId}`);
    
    return getCachedOrFetch(
      cacheKey,
      async () => {
        // Use retry for database query
        return retry(
          async () => {
            const item = await db.query.inventory.findFirst({
              where: and(
                eq(inventory.id, inventoryId),
                eq(inventory.storeId, storeId)
              ),
              with: {
                product: true,
                batches: {
                  orderBy: [
                    { expiryDate: 'asc' },
                    { createdAt: 'asc' }
                  ]
                }
              }
            });

            if (!item) {
              throw new Error(`Inventory item not found: ${inventoryId} in store ${storeId}`);
            }

            return item;
          },
          { 
            maxAttempts: 3,
            operationName: `getInventoryItem:${inventoryId}:${storeId}`
          }
        );
      },
      300 // 5 minutes TTL
    );
  }

  /**
   * Update inventory quantity with transaction retry
   */
  async updateInventoryQuantity(
    inventoryId: number,
    quantityChange: number,
    batchId?: number,
    reason?: string
  ): Promise<any> {
    return withTransaction(
      async (tx) => {
        // Lock the inventory record for update
        const inventoryItem = await tx.query.inventory.findFirst({
          where: eq(inventory.id, inventoryId),
          for: 'update'
        });

        if (!inventoryItem) {
          throw new Error(`Inventory not found: ${inventoryId}`);
        }

        // Calculate new quantity
        const newQuantity = inventoryItem.totalQuantity + quantityChange;
        
        if (newQuantity < 0 && !process.env.ALLOW_NEGATIVE_INVENTORY) {
          throw new Error(`Cannot reduce inventory below zero: ${inventoryId}`);
        }

        // Update inventory record
        await tx.update(inventory)
          .set({ 
            totalQuantity: newQuantity,
            updatedAt: new Date()
          })
          .where(eq(inventory.id, inventoryId));

        // If batch specified, update batch quantity
        if (batchId) {
          const batch = await tx.query.inventoryBatches.findFirst({
            where: eq(inventoryBatches.id, batchId),
            for: 'update'
          });

          if (!batch) {
            throw new Error(`Batch not found: ${batchId}`);
          }

          const newBatchQuantity = batch.quantity + quantityChange;
          
          if (newBatchQuantity < 0) {
            throw new Error(`Cannot reduce batch quantity below zero: ${batchId}`);
          }

          await tx.update(inventoryBatches)
            .set({ 
              quantity: newBatchQuantity,
              updatedAt: new Date()
            })
            .where(eq(inventoryBatches.id, batchId));
        }

        // Record inventory transaction
        await tx.insert(schema.inventoryTransactions)
          .values({
            inventoryId,
            batchId,
            quantityChange,
            reason: reason || 'manual-adjustment',
            createdAt: new Date(),
            newTotalQuantity: newQuantity
          });

        // Check if we need to trigger auto-ordering
        if (inventoryItem.reorderLevel && newQuantity <= inventoryItem.reorderLevel) {
          // Log reorder notification
          logger.info('Inventory needs reordering', {
            inventoryId,
            productId: inventoryItem.productId,
            currentQuantity: newQuantity,
            reorderLevel: inventoryItem.reorderLevel,
            minimumLevel: inventoryItem.minimumLevel
          });
          
          // Queue auto-reorder if enabled
          if (inventoryItem.autoReorder) {
            await this.queueAutoReorder(tx, inventoryItem);
          }
        }

        // Return updated inventory
        return {
          ...inventoryItem,
          totalQuantity: newQuantity
        };
      },
      {
        maxRetries: 5,
        transactionName: `update-inventory-quantity:${inventoryId}:${quantityChange}`,
        serializable: true
      }
    ).then(result => {
      // Invalidate cache after successful update
      invalidateEntityCache('INVENTORY' as any, `${result.storeId}:${result.id}`);
      return result;
    });
  }

  /**
   * Queue auto-reorder for inventory
   * Private helper method
   */
  private async queueAutoReorder(tx: any, inventory: any): Promise<void> {
    try {
      // Check if a reorder request already exists and is pending
      const existingReorder = await tx.query.reorderRequests.findFirst({
        where: and(
          eq(reorderRequests.inventoryId, inventory.id),
          eq(reorderRequests.status, 'pending')
        )
      });

      if (existingReorder) {
        return;
      }

      // Insert reorder request
      await tx.insert(reorderRequests).values({
        inventoryId: inventory.id,
        productId: inventory.productId,
        storeId: inventory.storeId,
        requestedQuantity: inventory.minimumLevel - inventory.totalQuantity,
        status: 'pending',
        createdAt: new Date()
      });
    } catch (error) {
      // Log error but don't fail the transaction
      logger.error('Failed to queue auto-reorder', {
        inventoryId: inventory.id,
        error
      });
    }
  }

  /**
   * Process pending reorders in a batch
   * Can be called by a scheduled job
   */
  async processPendingReorders(storeId: number): Promise<{
    processed: number;
    failed: number;
    details: any[];
  }> {
    // Find pending reorder requests
    const pendingReorders = await db.query.reorderRequests.findMany({
      where: and(
        eq(reorderRequests.storeId, storeId),
        eq(reorderRequests.status, 'pending')
      ),
      with: {
        inventory: true,
        product: true
      }
    });

    if (!pendingReorders.length) {
      return { processed: 0, failed: 0, details: [] };
    }

    logger.info(`Processing ${pendingReorders.length} pending reorders for store ${storeId}`);

    const results = {
      processed: 0,
      failed: 0,
      details: [] as any[]
    };

    // Process each reorder with retry logic
    for (const reorder of pendingReorders) {
      try {
        // Check supplier availability first
        const availability = await this.supplierApi.checkAvailability(
          reorder.product.supplierProductId || String(reorder.productId)
        );

        if (!availability.available) {
          // Update status to supplier-unavailable
          await db.update(reorderRequests)
            .set({
              status: 'supplier-unavailable',
              notes: `Supplier reported product unavailable at ${new Date().toISOString()}`,
              updatedAt: new Date()
            })
            .where(eq(reorderRequests.id, reorder.id));

          results.failed++;
          results.details.push({
            reorderId: reorder.id,
            productId: reorder.productId,
            status: 'supplier-unavailable'
          });
          continue;
        }

        // Place order with supplier
        const orderResult = await this.supplierApi.placeOrder({
          productId: reorder.product.supplierProductId || String(reorder.productId),
          quantity: reorder.requestedQuantity,
          storeId: String(storeId),
          reference: `reorder-${reorder.id}`
        });

        // Update reorder status
        await db.update(reorderRequests)
          .set({
            status: 'ordered',
            supplierOrderId: orderResult.orderId,
            updatedAt: new Date()
          })
          .where(eq(reorderRequests.id, reorder.id));

        results.processed++;
        results.details.push({
          reorderId: reorder.id,
          productId: reorder.productId,
          status: 'ordered',
          orderId: orderResult.orderId
        });
      } catch (error) {
        logger.error('Failed to process reorder', {
          reorderId: reorder.id,
          productId: reorder.productId,
          error
        });

        // Update status to failed
        await db.update(reorderRequests)
          .set({
            status: 'failed',
            notes: `Error: ${error instanceof Error ? error.message : String(error)}`,
            updatedAt: new Date()
          })
          .where(eq(reorderRequests.id, reorder.id));

        results.failed++;
        results.details.push({
          reorderId: reorder.id,
          productId: reorder.productId,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return results;
  }

  /**
   * Check for inventory batches nearing expiry
   * Can be called by a scheduled job
   */
  async checkExpiringBatches(
    storeId: number,
    daysUntilExpiry: number = 30
  ): Promise<any[]> {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + daysUntilExpiry);

    // Query for batches expiring within the time window
    return withTransaction(
      async (tx) => {
        const expiringBatches = await tx.query.inventoryBatches.findMany({
          where: and(
            eq(inventoryBatches.storeId, storeId),
            lessOrEqual(
              inventoryBatches.expiryDate,
              new Date(Date.now() + daysUntilExpiry * 24 * 60 * 60 * 1000)
            ),
            greaterThan(inventoryBatches.quantity, 0)
          ),
          with: {
            inventory: {
              with: {
                product: true
              }
            }
          },
          orderBy: [
            { expiryDate: 'asc' }
          ]
        });

        // Mark batches as flagged for expiry
        for (const batch of expiringBatches) {
          if (!batch.expiryFlagged) {
            await tx.update(schema.inventoryBatches)
              .set({
                expiryFlagged: true,
                updatedAt: new Date()
              })
              .where(eq(schema.inventoryBatches.id, batch.id));
          }
        }

        return expiringBatches;
      },
      {
        transactionName: `check-expiring-batches:${storeId}:${daysUntilExpiry}`,
        serializable: false
      }
    );
  }
}
