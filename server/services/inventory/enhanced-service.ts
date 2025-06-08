/**
 * Enhanced Inventory Service
 *
 * A refactored version of the Inventory service that uses the enhanced base service
 * and utility abstractions to reduce code duplication and improve type safety.
 */
import * as schema from '@shared/schema';
import { inventoryValidation } from '@shared/schema-validation';
import { ErrorCode } from '@shared/types/errors';
import { formatDateForSql, formatJsonForSql } from '@shared/utils/sql-helpers';
import {
  eq,
  and,
  or,
  like,
  desc,
  asc,
  sql,
  gt,
  SQL,
  inArray,
  AnyColumn,
  getTableName,
} from 'drizzle-orm';
import { z } from 'zod';

import {
  InventoryFormatter,
  InventoryItemFormatter, // Assuming this formats InventoryBatch
  InventoryTransactionFormatter,
} from './formatter';
import {
  CreateInventoryParams,
  UpdateInventoryParams,
  InventoryAdjustmentParams,
  InventoryBatchParams,
  InventoryTransactionType,
  IInventoryService,
  InventoryServiceErrors,
  InventorySearchParams,
} from './types';
import { db } from '../../../db';
import { EnhancedBaseService } from '../base/enhanced-service';

// Removed PgSelect import, will let TypeScript infer 'query' type

import { ServiceConfig } from '../base/service-factory';

export class EnhancedInventoryService extends EnhancedBaseService implements IInventoryService {
  private inventoryFormatter: InventoryFormatter;
  private itemFormatter: InventoryItemFormatter;
  private transactionFormatter: InventoryTransactionFormatter;

  constructor(config: ServiceConfig) {
    super(config);
    this.inventoryFormatter = new InventoryFormatter();
    this.itemFormatter = new InventoryItemFormatter();
    this.transactionFormatter = new InventoryTransactionFormatter();
  }

  async createInventory(params: CreateInventoryParams): Promise<schema.Inventory> {
    try {
      const product = await this.getProductById(params.productId);
      if (!product) {
        throw InventoryServiceErrors.PRODUCT_NOT_FOUND;
      }

      const store = await this.getStoreById(params.storeId);
      if (!store) {
        throw InventoryServiceErrors.STORE_NOT_FOUND;
      }

      const existingInventory = await this.getInventoryByProduct(params.productId, params.storeId);
      if (existingInventory) {
        const updateParams: UpdateInventoryParams = {
          totalQuantity: params.totalQuantity,
          availableQuantity: params.availableQuantity,
          minimumLevel: params.minimumLevel,
          batchTracking: params.batchTracking,
        };
        return this.updateInventory(existingInventory.id, updateParams);
      }

      const inventoryData: z.input<typeof schema.inventoryInsertSchema> = {
        productId: params.productId,
        storeId: params.storeId,
        totalQuantity: params.totalQuantity,
        minimumLevel: params.minimumLevel,
        batchTracking: params.batchTracking ?? false,
        status: schema.inventoryStatus.options[0],
        // createdAt and updatedAt are typically handled by DB defaults
        // id is auto-generated
        // deletedAt is nullable and optional
      };

      // The inventorySchema in schema-validation.ts should now correctly handle batchTracking
      const validatedData = inventoryValidation.insert(inventoryData);

      const result = await this.rawInsertWithFormatting(
        getTableName(schema.inventory), // Use getTableName
        validatedData,
        this.inventoryFormatter.formatResult.bind(this.inventoryFormatter)
      );
      return this.ensureExists(result as schema.Inventory | null, 'Inventory');
    } catch (error: unknown) {
      return this.handleError(error, 'creating inventory');
    }
  }

  async updateInventory(
    inventoryId: number,
    params: UpdateInventoryParams
  ): Promise<schema.Inventory> {
    try {
      const existingInventory = await this.getInventoryById(inventoryId);
      if (!existingInventory) {
        throw InventoryServiceErrors.INVENTORY_NOT_FOUND;
      }

      const updateData: Partial<z.input<typeof schema.inventoryUpdateSchema>> = {
        totalQuantity: params.totalQuantity,
        minimumLevel: params.minimumLevel,
        batchTracking: params.batchTracking,
        // id, productId, storeId are typically not updatable or handled by where clause
        // createdAt, status, deletedAt might also be handled differently or not part of typical updates
        // updatedAt is typically handled by DB defaults
      };

      // The inventorySchema in schema-validation.ts should now correctly handle batchTracking
      const validatedData = inventoryValidation.update(updateData);

      const updatedInventory = await this.rawUpdateWithFormatting(
        getTableName(schema.inventory), // Use getTableName
        validatedData,
        `id = ${inventoryId}`,
        this.inventoryFormatter.formatResult.bind(this.inventoryFormatter)
      );

      return this.ensureExists(updatedInventory as schema.Inventory | null, 'Inventory');
    } catch (error: unknown) {
      return this.handleError(error, 'updating inventory');
    }
  }

  async getInventoryById(inventoryId: number): Promise<schema.Inventory | null> {
    try {
      const [result] = await db
        .select()
        .from(schema.inventory)
        .where(eq(schema.inventory.id, inventoryId))
        .limit(1);
      return result || null;
    } catch (error: unknown) {
      return this.handleError(error, 'getting inventory by ID');
    }
  }

  async getInventoryByProduct(
    productId: number,
    storeId?: number
  ): Promise<schema.Inventory | null> {
    try {
      const conditions: SQL[] = [eq(schema.inventory.productId, productId)];
      if (storeId) {
        conditions.push(eq(schema.inventory.storeId, storeId));
      }
      const [result] = await db
        .select()
        .from(schema.inventory)
        .where(and(...conditions))
        .limit(1);
      return result || null;
    } catch (error: unknown) {
      return this.handleError(error, 'getting inventory by product');
    }
  }

  async addInventoryBatch(params: InventoryBatchParams): Promise<schema.InventoryBatch> {
    try {
      const product = await this.getProductById(params.productId);
      if (!product) {
        throw InventoryServiceErrors.PRODUCT_NOT_FOUND;
      }

      let inventory = await this.getInventoryByProduct(params.productId, params.storeId);
      if (!inventory) {
        inventory = await this.createInventory({
          productId: params.productId,
          storeId: params.storeId,
          totalQuantity: 0,
          availableQuantity: 0,
          minimumLevel: 0,
          batchTracking: true,
        });
      }

      if (!inventory.batchTracking) {
        inventory = await this.updateInventory(inventory.id, { batchTracking: true });
      }

      const batchData: schema.InventoryBatchInsert = {
        inventoryId: inventory.id,
        batchNumber: params.batchNumber || `B${Date.now()}`,
        quantity: params.quantity,
        costPerUnit: params.cost,
        expiryDate: params.expiryDate,
        receivedDate: params.purchaseDate,
        supplierId: (params as any).supplierId,
      };

      const validatedBatchData = schema.inventoryBatchInsertSchema.parse(batchData);

      const [insertedBatch] = await db
        .insert(schema.inventoryBatches)
        .values(validatedBatchData)
        .returning();

      if (!insertedBatch) {
        throw new Error('Failed to create inventory batch item.');
      }

      await this.adjustInventory({
        productId: params.productId,
        storeId: params.storeId,
        quantity: params.quantity,
        type: InventoryTransactionType.PURCHASE,
        cost: params.cost,
        reference: params.supplierReference || `BatchReceipt-${insertedBatch.id}`,
        notes: params.notes || `Batch ${insertedBatch.batchNumber} received`,
        userId: params.userId,
        batchId: insertedBatch.id,
        reason: 'Batch receipt',
      });

      await db
        .update(schema.inventory)
        .set({ totalQuantity: sql`${schema.inventory.totalQuantity} + ${params.quantity}` })
        .where(eq(schema.inventory.id, inventory.id));

      return insertedBatch;
    } catch (error: unknown) {
      return this.handleError(error, 'adding inventory batch');
    }
  }

  async adjustInventory(params: InventoryAdjustmentParams): Promise<boolean> {
    try {
      const {
        productId,
        storeId,
        quantity,
        type,
        cost,
        reference,
        notes,
        userId,
        batchId,
        reason,
      } = params;

      const inventoryRecord = await this.getInventoryByProduct(productId, storeId);
      if (!inventoryRecord) {
        throw InventoryServiceErrors.INVENTORY_NOT_FOUND;
      }

      let itemToAdjust: schema.InventoryBatch | undefined;
      let beforeQuantity: number;

      if (batchId) {
        const [foundBatch] = await db
          .select()
          .from(schema.inventoryBatches)
          .where(
            and(
              eq(schema.inventoryBatches.id, batchId),
              eq(schema.inventoryBatches.inventoryId, inventoryRecord.id)
            )
          );
        if (!foundBatch) throw InventoryServiceErrors.BATCH_NOT_FOUND;
        itemToAdjust = foundBatch;
        beforeQuantity = itemToAdjust.quantity;
      } else {
        beforeQuantity = inventoryRecord.totalQuantity;
      }

      const afterQuantity = beforeQuantity + quantity;

      if (quantity < 0 && afterQuantity < 0) {
        throw InventoryServiceErrors.INSUFFICIENT_STOCK;
      }

      if (itemToAdjust) {
        await db
          .update(schema.inventoryBatches)
          .set({ quantity: afterQuantity, updatedAt: new Date() })
          .where(eq(schema.inventoryBatches.id, itemToAdjust.id));
      }

      await db
        .update(schema.inventory)
        .set({
          totalQuantity: sql`${schema.inventory.totalQuantity} + ${quantity}`,
          updatedAt: new Date(),
        })
        .where(eq(schema.inventory.id, inventoryRecord.id));

      const transactionData: schema.InventoryTransactionInsert = {
        inventoryId: inventoryRecord.id,
        itemId: itemToAdjust?.id,
        batchId: batchId,
        transactionType: type,
        quantity: quantity,
        beforeQuantity: beforeQuantity,
        afterQuantity: afterQuantity,
        unitCost: cost || (itemToAdjust?.costPerUnit ?? '0'),
        totalCost: (Number(cost || itemToAdjust?.costPerUnit || '0') * Math.abs(quantity)).toFixed(
          2
        ),
        referenceId: reference,
        notes: notes || reason,
        performedBy: userId,
        transactionDate: new Date(),
      };

      const validatedTransactionData =
        schema.inventoryTransactionInsertSchema.parse(transactionData);
      await db.insert(schema.inventoryTransactions).values(validatedTransactionData);

      return true;
    } catch (error: unknown) {
      this.handleError(error, 'adjusting inventory');
      return false;
    }
  }

  private async getProductById(productId: number): Promise<schema.Product | null> {
    try {
      const [product] = await db
        .select()
        .from(schema.products)
        .where(eq(schema.products.id, productId))
        .limit(1);
      return product || null;
    } catch (error: unknown) {
      this.logger.error('Error fetching product by ID', { error, productId });
      return null;
    }
  }

  private async getStoreById(storeId: number): Promise<schema.Store | null> {
    try {
      const [store] = await db
        .select()
        .from(schema.stores)
        .where(eq(schema.stores.id, storeId))
        .limit(1);
      return store || null;
    } catch (error: unknown) {
      this.logger.error('Error fetching store by ID', { error, storeId });
      return null;
    }
  }

  async getBatchesByProduct(productId: number): Promise<schema.InventoryBatch[]> {
    const inventoryRecord = await this.getInventoryByProduct(productId);
    if (!inventoryRecord) return [];
    return db
      .select()
      .from(schema.inventoryBatches)
      .where(eq(schema.inventoryBatches.inventoryId, inventoryRecord.id));
  }

  async getLowStockItems(storeId: number, limit: number = 20): Promise<schema.Inventory[]> {
    return db
      .select()
      .from(schema.inventory)
      .where(
        and(
          eq(schema.inventory.storeId, storeId),
          sql`${schema.inventory.totalQuantity} <= ${schema.inventory.minimumLevel}`,
          gt(schema.inventory.minimumLevel, 0)
        )
      )
      .orderBy(asc(sql`${schema.inventory.totalQuantity} - ${schema.inventory.minimumLevel}`))
      .limit(limit);
  }

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
    this.logger.warn('getInventoryValuation is a placeholder and needs a proper implementation.');
    return {
      totalValue: '0.00',
      totalItems: 0,
      valuationDate: new Date(),
      breakdown: [],
    };
  }

  async searchInventory(params: InventorySearchParams): Promise<{
    inventory: schema.Inventory[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const conditions: SQL[] = [];
    if (params.storeId) {
      conditions.push(eq(schema.inventory.storeId, params.storeId));
    }

    if (params.query) {
      this.logger.warn(
        'Search by query in inventory requires joining products table - not fully implemented.'
      );
    }
    if (params.categoryId) {
      this.logger.warn(
        'Search by categoryId in inventory requires joining products table - not fully implemented.'
      );
    }
    if (params.lowStock) {
      conditions.push(sql`${schema.inventory.totalQuantity} <= ${schema.inventory.minimumLevel}`);
      conditions.push(gt(schema.inventory.minimumLevel, 0));
    }
    if (params.outOfStock) {
      conditions.push(eq(schema.inventory.totalQuantity, 0));
    }
    if (params.batchTracking !== undefined) {
      conditions.push(eq(schema.inventory.batchTracking, params.batchTracking));
    }

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.inventory)
      .where(and(...conditions));
    const total = Number(countResult[0]?.count || 0);

    let query = db
      .select()
      .from(schema.inventory)
      .where(and(...conditions)); // Reverted to implicit typing for query

    if (params.sortBy && schema.inventory[params.sortBy as keyof typeof schema.inventory]) {
      const sortColumn = schema.inventory[
        params.sortBy as keyof typeof schema.inventory
      ] as AnyColumn;
      const direction = params.sortOrder === 'desc' ? desc : asc;
      query = query.orderBy(direction(sortColumn));
    } else {
      query = query.orderBy(desc(schema.inventory.updatedAt));
    }

    const items = await query.limit(limit).offset((page - 1) * limit);
    return { inventory: items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

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
    const conditions = [eq(schema.inventory.storeId, storeId)];
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.inventory)
      .where(and(...conditions));
    const total = Number(countResult[0]?.count || 0);

    const items = await db
      .select()
      .from(schema.inventory)
      .where(and(...conditions))
      .orderBy(desc(schema.inventory.updatedAt))
      .limit(limit)
      .offset((page - 1) * limit);

    return { inventory: items, total, page, limit };
  }
}
