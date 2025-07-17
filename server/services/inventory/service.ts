/**
 * Inventory Service Implementation
 *
 * This file implements a standardized inventory service with proper schema validation
 * and error handling according to our schema style guide.
 */

import { BaseService } from '../base/service';
import {
  IInventoryService,
  InventoryServiceErrors,
  CreateInventoryParams,
  UpdateInventoryParams,
  InventoryAdjustmentParams,
  InventoryBatchParams,
  InventorySearchParams,
  InventoryAdjustmentType,
} from './types';
import { db } from '@db';
import * as schema from '@shared/schema';
import { eq, and, gt, desc, asc, sql, like, or } from 'drizzle-orm';
import { inventoryValidation, SchemaValidationError } from '@shared/schema-validation';

export class InventoryService extends BaseService implements IInventoryService {
  /**
   * Create a new inventory record with validated data
   */
  async createInventory(params: CreateInventoryParams): Promise<schema.Inventory> {
    try {
      // Verify product exists
      const product = await db.query.products.findFirst({
        where: eq(schema.products.id, params.productId),
      });

      if (!product) {
        throw InventoryServiceErrors.PRODUCT_NOT_FOUND;
      }

      // Verify store exists
      const store = await db.query.stores.findFirst({
        where: eq(schema.stores.id, params.storeId),
      });

      if (!store) {
        throw InventoryServiceErrors.STORE_NOT_FOUND;
      }

      // Check if inventory already exists for this product
      const existingInventory = await db.query.inventory.findFirst({
        where: eq(schema.inventory.productId, params.productId),
      });

      if (existingInventory) {
        // Update existing inventory instead of creating new
        return this.updateInventory(existingInventory.id, params);
      }

      // Prepare inventory data with camelCase field names
      const inventoryData = {
        productId: params.productId,
        storeId: params.storeId,
        totalQuantity: params.totalQuantity,
        availableQuantity: params.availableQuantity,
        minimumLevel: params.minimumLevel,
        batchTracking: params.batchTracking ?? false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Validate with our schema validation
      const validatedData = inventoryValidation.insert(inventoryData);

      // Insert validated data
      const [inventory] = await db.insert(schema.inventory).values(validatedData).returning();

      return inventory;
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        console.error(`Validation error: ${error.message}`, error.toJSON());
      }
      return this.handleError(error, 'Creating inventory');
    }
  }

  /**
   * Update an inventory record with validated data
   */
  async updateInventory(
    inventoryId: number,
    params: UpdateInventoryParams
  ): Promise<schema.Inventory> {
    try {
      // Verify inventory exists
      const existingInventory = await db.query.inventory.findFirst({
        where: eq(schema.inventory.id, inventoryId),
      });

      if (!existingInventory) {
        throw InventoryServiceErrors.INVENTORY_NOT_FOUND;
      }

      // Prepare update data with proper camelCase field names
      const updateData = {
        ...params,
        updatedAt: new Date(),
      };

      // Validate the update data
      const validatedData = inventoryValidation.update(updateData);

      // Update with validated data
      const [updatedInventory] = await db
        .update(schema.inventory)
        .set(validatedData)
        .where(eq(schema.inventory.id, inventoryId))
        .returning();

      return updatedInventory;
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        console.error(`Validation error: ${error.message}`, error.toJSON());
      }
      return this.handleError(error, 'Updating inventory');
    }
  }

  /**
   * Get inventory by product ID
   */
  async getInventoryByProduct(productId: number): Promise<schema.Inventory | null> {
    try {
      const inventory = await db.query.inventory.findFirst({
        where: eq(schema.inventory.productId, productId),
        with: {
          product: true,
          store: true,
          batches: {
            orderBy: [desc(schema.inventoryBatches.createdAt)],
          },
        },
      });

      return inventory;
    } catch (error) {
      return this.handleError(error, 'Getting inventory by product');
    }
  }

  /**
   * Get inventory by store ID with pagination
   */
  async getInventoryByStore(
    storeId: number,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    inventory: schema.Inventory[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const offset = (page - 1) * limit;

      // Verify store exists
      const store = await db.query.stores.findFirst({
        where: eq(schema.stores.id, storeId),
      });

      if (!store) {
        throw InventoryServiceErrors.STORE_NOT_FOUND;
      }

      // Count total results
      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.inventory)
        .where(eq(schema.inventory.storeId, storeId));

      const total = Number(countResult?.count || 0);

      // Get inventory records
      const inventory = await db.query.inventory.findMany({
        where: eq(schema.inventory.storeId, storeId),
        limit,
        offset,
        with: {
          product: true,
        },
      });

      return {
        inventory,
        total,
        page,
        limit,
      };
    } catch (error) {
      return this.handleError(error, 'Getting inventory by store');
    }
  }

  /**
   * Search inventory with advanced filters
   */
  async searchInventory(params: InventorySearchParams): Promise<{
    inventory: schema.Inventory[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const page = params.page || 1;
      const limit = params.limit || 20;
      const offset = (page - 1) * limit;

      // Build where clause
      let whereClause = eq(schema.inventory.storeId, params.storeId);

      // Join with products table for product-related filters (query removed during refactor)

      // Apply additional filters
      if (params.query) {
        const searchQuery = `%${params.query}%`;
        whereClause = and(
          whereClause,
          or(like(schema.products.name, searchQuery), like(schema.products.sku, searchQuery))
        );
      }

      if (params.categoryId) {
        whereClause = and(whereClause, eq(schema.products.categoryId, params.categoryId));
      }

      if (params.lowStock) {
        whereClause = and(
          whereClause,
          sql`${schema.inventory.availableQuantity} <= ${schema.inventory.minimumLevel}`
        );
      }

      if (params.outOfStock) {
        whereClause = and(whereClause, eq(schema.inventory.availableQuantity, 0));
      }

      if (params.batchTracking !== undefined) {
        whereClause = and(whereClause, eq(schema.inventory.batchTracking, params.batchTracking));
      }

      // Count total results
      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.inventory)
        .leftJoin(schema.products, eq(schema.inventory.productId, schema.products.id))
        .where(whereClause);

      const total = Number(countResult?.count || 0);

      // Determine sort order
      const sortField = params.sortBy || 'updatedAt';
      const sortDirection = params.sortDirection || 'desc';

      let orderByClause;
      switch (sortField) {
        case 'productName':
          orderByClause =
            sortDirection === 'asc' ? asc(schema.products.name) : desc(schema.products.name);
          break;
        case 'quantity':
          orderByClause =
            sortDirection === 'asc'
              ? asc(schema.inventory.availableQuantity)
              : desc(schema.inventory.availableQuantity);
          break;
        case 'updatedAt':
        default:
          orderByClause =
            sortDirection === 'asc'
              ? asc(schema.inventory.updatedAt)
              : desc(schema.inventory.updatedAt);
      }

      // Get inventory records
      const inventory = await db.query.inventory.findMany({
        where: whereClause,
        limit,
        offset,
        orderBy: [orderByClause],
        with: {
          product: true,
          store: true,
        },
      });

      return {
        inventory,
        total,
        page,
        limit,
      };
    } catch (error) {
      return this.handleError(error, 'Searching inventory');
    }
  }

  /**
   * Adjust inventory quantities with validated data
   */
  async adjustInventory(params: InventoryAdjustmentParams): Promise<boolean> {
    try {
      // Validate adjustment data
      const validatedData = inventoryValidation.adjustment(params);

      // Get current inventory
      const inventory = await this.getInventoryByProduct(params.productId);

      if (!inventory) {
        throw InventoryServiceErrors.INVENTORY_NOT_FOUND;
      }

      // Check for sufficient stock if it's a negative adjustment
      if (params.quantity < 0 && Math.abs(params.quantity) > inventory.availableQuantity) {
        throw InventoryServiceErrors.INSUFFICIENT_STOCK;
      }

      // Calculate new quantities
      const newTotal = inventory.totalQuantity + params.quantity;
      const newAvailable = inventory.availableQuantity + params.quantity;

      // Start a transaction
      return await db.transaction(async tx => {
        // Update inventory quantities
        await tx
          .update(schema.inventory)
          .set({
            totalQuantity: newTotal,
            availableQuantity: newAvailable,
            updatedAt: new Date(),
          })
          .where(eq(schema.inventory.id, inventory.id));

        // Create inventory log entry
        await tx.insert(schema.inventoryLogs).values({
          productId: params.productId,
          quantity: params.quantity,
          previousQuantity: inventory.availableQuantity,
          newQuantity: newAvailable,
          type: params.type,
          reason: params.reason,
          userId: params.userId,
          batchId: params.batchId,
          reference: params.reference,
          notes: params.notes,
          createdAt: new Date(),
        });

        // If we're using batch tracking and it's a negative adjustment, we need to update batch quantities
        if (inventory.batchTracking && params.quantity < 0 && params.batchId) {
          const batch = await tx.query.inventoryBatches.findFirst({
            where: eq(schema.inventoryBatches.id, params.batchId),
          });

          if (!batch) {
            throw InventoryServiceErrors.BATCH_NOT_FOUND;
          }

          const newBatchQuantity = batch.remainingQuantity + params.quantity;

          if (newBatchQuantity < 0) {
            throw InventoryServiceErrors.INSUFFICIENT_STOCK;
          }

          await tx
            .update(schema.inventoryBatches)
            .set({
              remainingQuantity: newBatchQuantity,
              updatedAt: new Date(),
            })
            .where(eq(schema.inventoryBatches.id, params.batchId));
        }

        return true;
      });
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        console.error(`Validation error: ${error.message}`, error.toJSON());
      }
      return this.handleError(error, 'Adjusting inventory');
    }
  }

  /**
   * Add a new inventory batch with validated data
   */
  async addInventoryBatch(params: InventoryBatchParams): Promise<schema.InventoryBatch> {
    try {
      // Verify product exists
      const product = await db.query.products.findFirst({
        where: eq(schema.products.id, params.productId),
      });

      if (!product) {
        throw InventoryServiceErrors.PRODUCT_NOT_FOUND;
      }

      // Get inventory and verify batch tracking is enabled
      const inventory = await this.getInventoryByProduct(params.productId);

      if (!inventory) {
        // Create inventory if it doesn't exist
        await this.createInventory({
          productId: params.productId,
          storeId: params.storeId,
          totalQuantity: 0,
          availableQuantity: 0,
          minimumLevel: 10,
          batchTracking: true,
        });
      } else if (!inventory.batchTracking) {
        // Enable batch tracking if not already enabled
        await this.updateInventory(inventory.id, { batchTracking: true });
      }

      // Prepare batch data with camelCase field names
      const batchData = {
        productId: params.productId,
        storeId: params.storeId,
        batchNumber: params.batchNumber || `BATCH-${Date.now()}`,
        initialQuantity: params.quantity,
        remainingQuantity: params.quantity,
        cost: params.cost,
        purchaseDate: params.purchaseDate,
        expiryDate: params.expiryDate,
        supplierReference: params.supplierReference,
        notes: params.notes,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Validate with our schema validation
      const validatedData = inventoryValidation.batch.insert(batchData);

      // Start a transaction
      return await db.transaction(async tx => {
        // Insert batch
        const [batch] = await tx.insert(schema.inventoryBatches).values(validatedData).returning();

        // Adjust inventory quantity
        await this.adjustInventory({
          productId: params.productId,
          quantity: params.quantity,
          reason: 'Batch added',
          type: InventoryAdjustmentType.PURCHASE,
          userId: params.userId,
          batchId: batch.id,
          cost: params.cost,
          notes: params.notes,
          reference: params.supplierReference,
        });

        return batch;
      });
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        console.error(`Validation error: ${error.message}`, error.toJSON());
      }
      return this.handleError(error, 'Adding inventory batch');
    }
  }

  /**
   * Get all batches for a product
   */
  async getBatchesByProduct(productId: number): Promise<schema.InventoryBatch[]> {
    try {
      const batches = await db.query.inventoryBatches.findMany({
        where: eq(schema.inventoryBatches.productId, productId),
        orderBy: [desc(schema.inventoryBatches.createdAt)],
      });

      return batches;
    } catch (error) {
      return this.handleError(error, 'Getting batches by product');
    }
  }

  /**
   * Get low stock items for a store
   */
  async getLowStockItems(storeId: number, limit: number = 20): Promise<schema.Inventory[]> {
    try {
      // Verify store exists
      const store = await db.query.stores.findFirst({
        where: eq(schema.stores.id, storeId),
      });

      if (!store) {
        throw InventoryServiceErrors.STORE_NOT_FOUND;
      }

      // Get inventory items where available quantity is less than or equal to minimum level
      const inventory = await db.query.inventory.findMany({
        where: and(
          eq(schema.inventory.storeId, storeId),
          sql`${schema.inventory.availableQuantity} <= ${schema.inventory.minimumLevel}`,
          gt(schema.inventory.minimumLevel, 0) // Only include items that have a minimum level set
        ),
        limit,
        orderBy: [asc(schema.inventory.availableQuantity)],
        with: {
          product: true,
        },
      });

      return inventory;
    } catch (error) {
      return this.handleError(error, 'Getting low stock items');
    }
  }

  /**
   * Get inventory valuation for a store
   */
  async getInventoryValuation(storeId: number): Promise<{
    totalValue: string;
    totalItems: number;
    valuationDate: Date;
    breakdown: Array<{
      categoryId: number;
      categoryName: string;
      value: string;
      itemCount: number;
    }>;
  }> {
    try {
      // Verify store exists
      const store = await db.query.stores.findFirst({
        where: eq(schema.stores.id, storeId),
      });

      if (!store) {
        throw InventoryServiceErrors.STORE_NOT_FOUND;
      }

      // Get total inventory value
      const valuationDate = new Date();

      // Get inventory items with their products and costs
      const inventoryItems = await db.query.inventory.findMany({
        where: eq(schema.inventory.storeId, storeId),
        with: {
          product: {
            with: {
              category: true,
            },
          },
          batches: true,
        },
      });

      // Calculate valuation
      let totalValue = 0;
      const categoryValues = new Map<number, { value: number; name: string; count: number }>();

      for (const item of inventoryItems) {
        let itemValue = 0;
        const product = item.product;

        if (item.batchTracking && item.batches?.length > 0) {
          // Calculate value based on remaining batch quantities and costs
          for (const batch of item.batches) {
            const batchCost = parseFloat(batch.cost);
            itemValue += batch.remainingQuantity * batchCost;
          }
        } else {
          // Calculate value based on product cost
          const productCost = parseFloat(product.cost || '0');
          itemValue = item.availableQuantity * productCost;
        }

        totalValue += itemValue;

        // Add to category breakdown
        const categoryId = product.categoryId || 0;
        const categoryName = product.category?.name || 'Uncategorized';

        if (!categoryValues.has(categoryId)) {
          categoryValues.set(categoryId, { value: 0, name: categoryName, count: 0 });
        }

        const categoryData = categoryValues.get(categoryId)!;
        categoryData.value += itemValue;
        categoryData.count += 1;
        categoryValues.set(categoryId, categoryData);
      }

      // Format breakdown data
      const breakdown = Array.from(categoryValues.entries()).map(([categoryId, data]) => ({
        categoryId,
        categoryName: data.name,
        value: data.value.toFixed(2),
        itemCount: data.count,
      }));

      return {
        totalValue: totalValue.toFixed(2),
        totalItems: inventoryItems.length,
        valuationDate,
        breakdown,
      };
    } catch (error) {
      return this.handleError(error, 'Getting inventory valuation');
    }
  }
}
