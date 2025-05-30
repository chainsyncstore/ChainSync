/**
 * Standardized Inventory Service
 * 
 * This implementation follows the standard service pattern and 
 * provides resilient inventory management functionality.
 */

import { z } from 'zod';
import { eq, and, gt, lte, sql } from 'drizzle-orm';
import { BaseService, ServiceError, ServiceConfig, RetryOptions } from '../base/standard-service';
import { CacheService } from '../cache';
import { ResilientHttpClient } from '../../utils/resilient-http-client';
import { CircuitBreaker } from '../../utils/fallback';
import { generateEntityCacheKey, invalidateEntityCache } from '@src/cache/cache-strategy';
import { inventory, inventoryBatches, products } from '@shared/db';
import { ErrorCode } from '@shared/types/errors';

// Schema definitions for input validation
const inventoryCreateSchema = z.object({
  productId: z.number(),
  storeId: z.number(),
  quantity: z.number().min(0),
  minQuantity: z.number().min(0).default(0),
  maxQuantity: z.number().min(0).optional(),
  locationCode: z.string().optional(),
  isActive: z.boolean().default(true),
});

const inventoryUpdateSchema = z.object({
  productId: z.number().optional(),
  storeId: z.number().optional(),
  quantity: z.number().min(0).optional(),
  minQuantity: z.number().min(0).optional(),
  maxQuantity: z.number().min(0).optional(),
  locationCode: z.string().optional(),
  isActive: z.boolean().optional(),
});

const batchCreateSchema = z.object({
  inventoryId: z.number(),
  quantity: z.number().min(0),
  costPrice: z.number().min(0),
  expiryDate: z.date().optional(),
  batchNumber: z.string().optional(),
  supplierReference: z.string().optional(),
  notes: z.string().optional(),
});

const batchUpdateSchema = z.object({
  inventoryId: z.number().optional(),
  quantity: z.number().min(0).optional(),
  costPrice: z.number().min(0).optional(),
  expiryDate: z.date().optional(),
  batchNumber: z.string().optional(),
  supplierReference: z.string().optional(),
  notes: z.string().optional(),
});

const quantityUpdateSchema = z.object({
  inventoryId: z.number(),
  quantity: z.number(),
  operation: z.enum(['add', 'subtract', 'set']),
  batchId: z.number().optional(),
  reason: z.string(),
  reference: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

// Type definitions
export interface Inventory {
  id: number;
  productId: number;
  storeId: number;
  quantity: number;
  minQuantity: number;
  maxQuantity?: number;
  locationCode?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryBatch {
  id: number;
  inventoryId: number;
  quantity: number;
  costPrice: number;
  expiryDate?: Date;
  batchNumber?: string;
  supplierReference?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuantityUpdateParams {
  inventoryId: number;
  quantity: number;
  operation: 'add' | 'subtract' | 'set';
  batchId?: number;
  reason: string;
  reference?: string;
  metadata?: Record<string, any>;
}

export interface InventoryWithProduct extends Inventory {
  product: {
    id: number;
    name: string;
    sku: string;
  };
}

export interface BatchWithInventory extends InventoryBatch {
  inventory: Inventory;
}

export interface SupplierAvailability {
  available: boolean;
  quantity: number;
  estimatedDeliveryDays: number;
}

/**
 * Supplier API service for ordering products
 */
class SupplierApiService {
  private client: ResilientHttpClient;
  private circuitBreaker: CircuitBreaker;

  constructor(
    baseURL: string = process.env.SUPPLIER_API_URL || 'https://api.suppliers.example.com',
    apiKey: string = process.env.SUPPLIER_API_KEY || ''
  ) {
    // Initialize the HTTP client with resilience features
    this.client = new ResilientHttpClient({
      baseURL,
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
        'X-API-Key': apiKey,
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
  async checkAvailability(productId: string): Promise<SupplierAvailability> {
    try {
      return await this.client.get(`/products/${productId}/availability`);
    } catch (error: unknown) {
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
  async placeOrder(orderData: unknown): Promise<{ orderId: string; status: string }> {
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
  async processBatchUpdates(updates: unknown[]): Promise<any[]> {
    return this.circuitBreaker.execute(async () => {
      return this.client.post('/inventory/batch-update', { updates });
    });
  }
}

/**
 * Standardized Inventory Service implementation
 */
export class InventoryService extends BaseService<Inventory, 
  z.infer<typeof inventoryCreateSchema>, 
  z.infer<typeof inventoryUpdateSchema>> {
  
  protected readonly entityName = 'inventory';
  protected readonly tableName = inventory;
  protected readonly primaryKeyField = 'id';
  protected readonly createSchema = inventoryCreateSchema;
  protected readonly updateSchema = inventoryUpdateSchema;
  
  private readonly batchesTableName = inventoryBatches;
  private readonly productsTableName = products;
  private readonly supplierApi: SupplierApiService;
  
  /**
   * Cache TTLs (in seconds)
   */
  private readonly CACHE_TTL = {
    INVENTORY: 3600, // 1 hour
    BATCH: 3600, // 1 hour
    INVENTORY_LIST: 300, // 5 minutes
    LOW_STOCK: 300, // 5 minutes
  };
  
  constructor(
    config: ServiceConfig & { 
      supplierApiBaseUrl?: string;
      supplierApiKey?: string;
    }
  ) {
    super(config);
    
    // Initialize supplier API service
    this.supplierApi = new SupplierApiService(
      config.supplierApiBaseUrl,
      config.supplierApiKey
    );
    
    this.logger.info('InventoryService initialized with supplier API integration');
  }
  
  /**
   * Get inventory with product details
   */
  async getInventoryWithProduct(id: number): Promise<InventoryWithProduct | null> {
    try {
      const cacheKey = `inventory:with-product:${id}`;
      
      // Try to get from cache first if available
      if (this.cache) {
        const cached = await this.cache.get(cacheKey);
        if (cached) {
          this.logger.debug(`Cache hit for ${cacheKey}`);
          return cached as InventoryWithProduct;
        }
      }
      
      // Fetch from database if not in cache
      const result = await this.executeQuery(
        async (db) => {
          return db.select({
            inventory: inventory,
            product: {
              id: products.id,
              name: products.name,
              sku: products.sku,
            }
          })
          .from(inventory)
          .innerJoin(products, eq(inventory.productId, products.id))
          .where(eq(inventory.id, id))
          .limit(1);
        },
        'inventory.getWithProduct'
      );
      
      if (!result.length) {
        return null;
      }
      
      // Transform result to expected format
      const inventoryWithProduct: InventoryWithProduct = {
        ...result[0].inventory,
        product: result[0].product
      };
      
      // Cache the result
      if (this.cache) {
        await this.cache.set(cacheKey, inventoryWithProduct, this.CACHE_TTL.INVENTORY);
      }
      
      return inventoryWithProduct;
    } catch (error) {
      return this.handleError(error, `Error fetching inventory with product details for ID: ${id}`);
    }
  }
  
  /**
   * Get inventory items with low stock (below minimum quantity)
   */
  async getLowStockItems(storeId?: number): Promise<InventoryWithProduct[]> {
    try {
      const cacheKey = `inventory:low-stock:${storeId || 'all'}`;
      
      // Try to get from cache first if available
      if (this.cache) {
        const cached = await this.cache.get(cacheKey);
        if (cached) {
          this.logger.debug(`Cache hit for ${cacheKey}`);
          return cached as InventoryWithProduct[];
        }
      }
      
      // Fetch from database if not in cache
      const result = await this.executeQuery(
        async (db) => {
          let query = db.select({
            inventory: inventory,
            product: {
              id: products.id,
              name: products.name,
              sku: products.sku,
            }
          })
          .from(inventory)
          .innerJoin(products, eq(inventory.productId, products.id))
          .where(
            and(
              eq(inventory.isActive, true),
              lte(inventory.quantity, inventory.minQuantity)
            )
          );
          
          if (storeId !== undefined) {
            query = query.where(eq(inventory.storeId, storeId));
          }
          
          return query;
        },
        'inventory.getLowStock'
      );
      
      // Transform results to expected format
      const lowStockItems: InventoryWithProduct[] = result.map(row => ({
        ...row.inventory,
        product: row.product
      }));
      
      // Cache the result
      if (this.cache) {
        await this.cache.set(cacheKey, lowStockItems, this.CACHE_TTL.LOW_STOCK);
      }
      
      return lowStockItems;
    } catch (error) {
      return this.handleError(error, `Error fetching low stock items${storeId ? ` for store ${storeId}` : ''}`);
    }
  }
  
  /**
   * Create a new inventory batch
   */
  async createBatch(data: z.infer<typeof batchCreateSchema>): Promise<InventoryBatch> {
    try {
      // Validate input data
      const validatedData = this.validateInput(data, batchCreateSchema);
      
      // Verify the inventory exists
      const inventoryExists = await this.getById(validatedData.inventoryId);
      if (!inventoryExists) {
        throw new ServiceError(
          ErrorCode.NOT_FOUND,
          `Inventory with ID ${validatedData.inventoryId} not found`,
          { inventoryId: validatedData.inventoryId }
        );
      }
      
      // Create the batch
      return await this.withTransaction(async (trx) => {
        // Insert the batch
        const batchResult = await trx
          .insert(this.batchesTableName)
          .values({
            ...validatedData,
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();
        
        const batch = batchResult[0];
        
        if (!batch) {
          throw new ServiceError(
            ErrorCode.DATABASE_ERROR,
            'Failed to create inventory batch',
            { data: validatedData }
          );
        }
        
        // Update inventory quantity
        await trx
          .update(this.tableName)
          .set({
            quantity: sql`${inventory.quantity} + ${validatedData.quantity}`,
            updatedAt: new Date()
          })
          .where(eq(inventory.id, validatedData.inventoryId));
        
        return batch;
      });
    } catch (error) {
      return this.handleError(error, 'Error creating inventory batch');
    }
  }
  
  /**
   * Update an inventory batch
   */
  async updateBatch(id: number, data: z.infer<typeof batchUpdateSchema>): Promise<InventoryBatch | null> {
    try {
      // Validate input data
      const validatedData = this.validateInput(data, batchUpdateSchema);
      
      // Get the existing batch
      const existingBatch = await this.executeQuery(
        async (db) => {
          return db
            .select()
            .from(this.batchesTableName)
            .where(eq(this.batchesTableName.id, id))
            .limit(1);
        },
        'inventoryBatch.getById'
      );
      
      if (!existingBatch.length) {
        throw new ServiceError(
          ErrorCode.NOT_FOUND,
          `Inventory batch with ID ${id} not found`,
          { batchId: id }
        );
      }
      
      const currentBatch = existingBatch[0];
      
      // Handle quantity update specially
      if (validatedData.quantity !== undefined && validatedData.quantity !== currentBatch.quantity) {
        return await this.withTransaction(async (trx) => {
          // Calculate quantity difference
          const quantityDiff = validatedData.quantity - currentBatch.quantity;
          
          // Update the batch
          const batchResult = await trx
            .update(this.batchesTableName)
            .set({
              ...validatedData,
              updatedAt: new Date()
            })
            .where(eq(this.batchesTableName.id, id))
            .returning();
          
          const batch = batchResult[0];
          
          if (!batch) {
            throw new ServiceError(
              ErrorCode.DATABASE_ERROR,
              `Failed to update inventory batch with ID ${id}`,
              { batchId: id, data: validatedData }
            );
          }
          
          // Update inventory quantity
          await trx
            .update(this.tableName)
            .set({
              quantity: sql`${inventory.quantity} + ${quantityDiff}`,
              updatedAt: new Date()
            })
            .where(eq(inventory.id, batch.inventoryId));
          
          return batch;
        });
      } else {
        // Simple update without quantity change
        const result = await this.executeQuery(
          async (db) => {
            return db
              .update(this.batchesTableName)
              .set({
                ...validatedData,
                updatedAt: new Date()
              })
              .where(eq(this.batchesTableName.id, id))
              .returning();
          },
          'inventoryBatch.update'
        );
        
        return result[0] || null;
      }
    } catch (error) {
      return this.handleError(error, `Error updating inventory batch with ID: ${id}`);
    }
  }
  
  /**
   * Get all batches for an inventory item
   */
  async getBatchesByInventoryId(inventoryId: number): Promise<InventoryBatch[]> {
    try {
      const cacheKey = `inventory:${inventoryId}:batches`;
      
      // Try to get from cache first if available
      if (this.cache) {
        const cached = await this.cache.get(cacheKey);
        if (cached) {
          this.logger.debug(`Cache hit for ${cacheKey}`);
          return cached as InventoryBatch[];
        }
      }
      
      // Fetch from database if not in cache
      const batches = await this.executeQuery(
        async (db) => {
          return db
            .select()
            .from(this.batchesTableName)
            .where(eq(this.batchesTableName.inventoryId, inventoryId))
            .orderBy(this.batchesTableName.createdAt);
        },
        'inventoryBatch.getByInventoryId'
      );
      
      // Cache the result
      if (this.cache) {
        await this.cache.set(cacheKey, batches, this.CACHE_TTL.BATCH);
      }
      
      return batches;
    } catch (error) {
      return this.handleError(error, `Error fetching batches for inventory ID: ${inventoryId}`);
    }
  }
  
  /**
   * Update inventory quantity
   */
  async updateQuantity(params: QuantityUpdateParams): Promise<Inventory> {
    try {
      // Validate input data
      const validatedData = this.validateInput(params, quantityUpdateSchema);
      
      return await this.withTransaction(async (trx) => {
        // Get current inventory
        const inventoryResult = await trx
          .select()
          .from(this.tableName)
          .where(eq(this.tableName.id, validatedData.inventoryId))
          .limit(1);
        
        if (!inventoryResult.length) {
          throw new ServiceError(
            ErrorCode.NOT_FOUND,
            `Inventory with ID ${validatedData.inventoryId} not found`,
            { inventoryId: validatedData.inventoryId }
          );
        }
        
        const currentInventory = inventoryResult[0];
        let newQuantity: number;
        
        // Calculate new quantity based on operation
        switch (validatedData.operation) {
          case 'add':
            newQuantity = currentInventory.quantity + validatedData.quantity;
            break;
          case 'subtract':
            newQuantity = currentInventory.quantity - validatedData.quantity;
            if (newQuantity < 0) {
              throw new ServiceError(
                ErrorCode.VALIDATION_ERROR,
                'Cannot reduce inventory below zero',
                { 
                  inventoryId: validatedData.inventoryId,
                  currentQuantity: currentInventory.quantity,
                  requestedReduction: validatedData.quantity
                }
              );
            }
            break;
          case 'set':
            newQuantity = validatedData.quantity;
            break;
          default:
            throw new ServiceError(
              ErrorCode.VALIDATION_ERROR,
              'Invalid operation',
              { operation: validatedData.operation }
            );
        }
        
        // Update inventory
        const updatedInventoryResult = await trx
          .update(this.tableName)
          .set({
            quantity: newQuantity,
            updatedAt: new Date()
          })
          .where(eq(this.tableName.id, validatedData.inventoryId))
          .returning();
        
        const updatedInventory = updatedInventoryResult[0];
        
        if (!updatedInventory) {
          throw new ServiceError(
            ErrorCode.DATABASE_ERROR,
            'Failed to update inventory quantity',
            { inventoryId: validatedData.inventoryId }
          );
        }
        
        // Update batch if specified
        if (validatedData.batchId) {
          // Get current batch
          const batchResult = await trx
            .select()
            .from(this.batchesTableName)
            .where(eq(this.batchesTableName.id, validatedData.batchId))
            .limit(1);
          
          if (!batchResult.length) {
            throw new ServiceError(
              ErrorCode.NOT_FOUND,
              `Batch with ID ${validatedData.batchId} not found`,
              { batchId: validatedData.batchId }
            );
          }
          
          const currentBatch = batchResult[0];
          let newBatchQuantity: number;
          
          // Calculate new batch quantity based on operation
          switch (validatedData.operation) {
            case 'add':
              newBatchQuantity = currentBatch.quantity + validatedData.quantity;
              break;
            case 'subtract':
              newBatchQuantity = currentBatch.quantity - validatedData.quantity;
              if (newBatchQuantity < 0) {
                throw new ServiceError(
                  ErrorCode.VALIDATION_ERROR,
                  'Cannot reduce batch below zero',
                  { 
                    batchId: validatedData.batchId,
                    currentQuantity: currentBatch.quantity,
                    requestedReduction: validatedData.quantity
                  }
                );
              }
              break;
            case 'set':
              newBatchQuantity = validatedData.quantity;
              break;
          }
          
          // Update batch
          await trx
            .update(this.batchesTableName)
            .set({
              quantity: newBatchQuantity,
              updatedAt: new Date()
            })
            .where(eq(this.batchesTableName.id, validatedData.batchId));
        }
        
        // Create audit log entry
        // This would be a separate table in a real implementation
        this.logger.info('Inventory quantity updated', {
          inventoryId: validatedData.inventoryId,
          batchId: validatedData.batchId,
          operation: validatedData.operation,
          quantity: validatedData.quantity,
          previousQuantity: currentInventory.quantity,
          newQuantity,
          reason: validatedData.reason,
          reference: validatedData.reference,
          metadata: validatedData.metadata,
          timestamp: new Date()
        });
        
        // Invalidate cache
        if (this.cache) {
          await this.cache.del(`inventory:${validatedData.inventoryId}`);
          await this.cache.del(`inventory:with-product:${validatedData.inventoryId}`);
          if (validatedData.batchId) {
            await this.cache.del(`inventory:${validatedData.inventoryId}:batches`);
          }
          await this.cache.invalidatePattern(`inventory:list:*`);
          await this.cache.invalidatePattern(`inventory:low-stock:*`);
        }
        
        return updatedInventory;
      });
    } catch (error) {
      return this.handleError(error, 'Error updating inventory quantity');
    }
  }
  
  /**
   * Check product availability from supplier
   */
  async checkSupplierAvailability(productId: string): Promise<SupplierAvailability> {
    try {
      const retryOptions: RetryOptions = {
        maxRetries: 3,
        baseDelayMs: 1000,
        retryableErrors: [ErrorCode.TEMPORARY_UNAVAILABLE, ErrorCode.EXTERNAL_SERVICE_ERROR]
      };
      
      return await this.withRetry(
        async () => this.supplierApi.checkAvailability(productId),
        retryOptions
      );
    } catch (error) {
      this.logger.warn('Failed to check supplier availability, using fallback', { 
        error, 
        productId 
      });
      
      // Return fallback response
      return {
        available: false,
        quantity: 0,
        estimatedDeliveryDays: 14,
      };
    }
  }
  
  /**
   * Place an order with supplier
   */
  async placeSupplierOrder(orderData: {
    productId: string;
    quantity: number;
    reference?: string;
    deliveryAddress?: Record<string, any>;
  }): Promise<{ orderId: string; status: string }> {
    try {
      return await this.supplierApi.placeOrder(orderData);
    } catch (error) {
      return this.handleError(error, 'Error placing supplier order');
    }
  }
  
  /**
   * Get order status from supplier
   */
  async getSupplierOrderStatus(orderId: string): Promise<{ status: string; trackingNumber?: string }> {
    try {
      return await this.supplierApi.getOrderStatus(orderId);
    } catch (error) {
      return this.handleError(error, 'Error getting supplier order status');
    }
  }
  
  /**
   * Process expired batches
   */
  async processExpiredBatches(): Promise<number> {
    try {
      const now = new Date();
      
      // Find expired batches
      const expiredBatches = await this.executeQuery(
        async (db) => {
          return db
            .select()
            .from(this.batchesTableName)
            .where(
              and(
                lte(this.batchesTableName.expiryDate, now),
                gt(this.batchesTableName.quantity, 0)
              )
            );
        },
        'inventory.findExpiredBatches'
      );
      
      if (!expiredBatches.length) {
        return 0;
      }
      
      // Process each expired batch
      let processedCount = 0;
      
      for (const batch of expiredBatches) {
        try {
          await this.updateQuantity({
            inventoryId: batch.inventoryId,
            quantity: batch.quantity,
            operation: 'subtract',
            batchId: batch.id,
            reason: 'expiry',
            reference: `expiry-${batch.id}`,
            metadata: {
              batchNumber: batch.batchNumber,
              expiryDate: batch.expiryDate,
              processingDate: now
            }
          });
          
          processedCount++;
        } catch (error) {
          this.logger.error('Failed to process expired batch', { 
            error, 
            batchId: batch.id,
            inventoryId: batch.inventoryId
          });
        }
      }
      
      return processedCount;
    } catch (error) {
      return this.handleError(error, 'Error processing expired batches');
    }
  }
  
  /**
   * Generate low stock report
   */
  async generateLowStockReport(storeId?: number): Promise<{
    timestamp: Date;
    storeId?: number;
    items: {
      id: number;
      productId: number;
      productName: string;
      sku: string;
      currentQuantity: number;
      minQuantity: number;
      deficit: number;
      supplierAvailability?: SupplierAvailability;
    }[];
  }> {
    try {
      // Get low stock items
      const lowStockItems = await this.getLowStockItems(storeId);
      
      // Build report items with supplier availability
      const reportItems = await Promise.all(
        lowStockItems.map(async item => {
          // Check supplier availability for items below minimum quantity
          let supplierAvailability: SupplierAvailability | undefined;
          
          if (item.quantity < item.minQuantity) {
            try {
              supplierAvailability = await this.checkSupplierAvailability(item.product.id.toString());
            } catch (error) {
              this.logger.warn('Failed to check supplier availability for product', {
                error,
                productId: item.product.id
              });
            }
          }
          
          return {
            id: item.id,
            productId: item.product.id,
            productName: item.product.name,
            sku: item.product.sku,
            currentQuantity: item.quantity,
            minQuantity: item.minQuantity,
            deficit: Math.max(0, item.minQuantity - item.quantity),
            supplierAvailability
          };
        })
      );
      
      return {
        timestamp: new Date(),
        storeId,
        items: reportItems
      };
    } catch (error) {
      return this.handleError(error, 'Error generating low stock report');
    }
  }
  
  /**
   * Override default cache key for inventory
   */
  protected getCacheKey(id: string | number): string | null {
    if (!this.cache) return null;
    return `inventory:${id}`;
  }
  
  /**
   * Override default list cache invalidation
   */
  protected async invalidateListCache(): Promise<void> {
    if (!this.cache) return;
    await this.cache.invalidatePattern(`inventory:list:*`);
    await this.cache.invalidatePattern(`inventory:low-stock:*`);
  }
}
