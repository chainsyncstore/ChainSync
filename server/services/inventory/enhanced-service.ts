/**
 * Enhanced Inventory Service
 *
 * A refactored version of the Inventory service that uses the enhanced
 * base service and utility abstractions to reduce code duplication and
 * improve type safety.
 */

import { EnhancedBaseService } from '../base/enhanced-service';
import {
  InventoryFormatter,
  InventoryItemFormatter,
  InventoryTransactionFormatter,
} from './formatter';
import { inventoryValidation, validateEntity } from '@shared/schema-validation';
import {
  CreateInventoryParams,
  UpdateInventoryParams,
  Inventory,
  InventoryItem,
  InventoryTransaction,
  CreateInventoryItemParams,
  UpdateInventoryItemParams,
  InventoryAdjustmentParams,
  InventoryBatchParams,
  InventoryTransactionType,
  IInventoryService,
  InventorySearchParams,
  InventoryServiceErrors,     // ✅ from types
} from './types';

import { db } from '@server/db';
import { sql, eq, and, desc } from 'drizzle-orm';
import * as schema from '@shared/schema';

export class EnhancedInventoryService
  extends EnhancedBaseService
  implements IInventoryService
{
  getInventoryByStore(storeId: number, page?: number, limit?: number): Promise<{ inventory: schema.Inventory[]; total: number; page: number; limit: number; }> {
    throw new Error('Method not implemented.');
  }
  searchInventory(params: InventorySearchParams): Promise<{ inventory: schema.Inventory[]; total: number; page: number; limit: number; }> {
    throw new Error('Method not implemented.');
  }
  addInventoryBatch(params: InventoryBatchParams): Promise<InventoryItem> {
    throw new Error('Method not implemented.');
  }
  getBatchesByProduct(productId: number): Promise<schema.InventoryBatch[]> {
    throw new Error('Method not implemented.');
  }
  getLowStockItems(storeId: number, limit?: number): Promise<schema.Inventory[]> {
    throw new Error('Method not implemented.');
  }
  getInventoryValuation(storeId: number): Promise<{ totalValue: string; totalItems: number; valuationDate: Date; breakdown: Array<{ categoryId: number; categoryName: string; value: string; itemCount: number; }>; }> {
    throw new Error('Method not implemented.');
  }
  private readonly inventoryFormatter = new InventoryFormatter();
  private readonly itemFormatter = new InventoryItemFormatter();
  private readonly transactionFormatter = new InventoryTransactionFormatter();

  /* -------------------------------------------------------------------------- */
  /*                               CRUD – INVENTORY                             */
  /* -------------------------------------------------------------------------- */

  async createInventory(params: CreateInventoryParams): Promise<Inventory> {
    try {
      const product = await this.getProductById(params.productId);
      if (!product) throw InventoryServiceErrors.PRODUCT_NOT_FOUND;

      const store = await this.getStoreById(params.storeId);
      if (!store) throw InventoryServiceErrors.STORE_NOT_FOUND;

      const existing = await this.getInventoryByProduct(
        params.productId,
        params.storeId,
      );
      if (existing) return this.updateInventory(existing.id, params);

      const data = {
        ...params,
        currentUtilization: params.currentUtilization ?? 0,
        lastAuditDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      };

      const validated = validateEntity(
        inventoryValidation.insert,
        data,
        'inventory',
      );

      const [inv] = await db.insert(schema.inventory).values(validated).returning();
      return this.ensureExists(inv as Inventory, 'Inventory');
    } catch (err) {
      return this.handleError(err, 'creating inventory');
    }
  }

  async updateInventory(
    id: number,
    params: UpdateInventoryParams,
  ): Promise<Inventory> {
    try {
      const existing = await this.getInventoryById(id);
      if (!existing) throw InventoryServiceErrors.INVENTORY_NOT_FOUND;

      const data = {
        ...params,
        updatedAt: new Date(),
        metadata: params.metadata
          ? JSON.stringify(params.metadata)
          : existing.metadata,
      };

      const validated = validateEntity(
        inventoryValidation.update,
        data,
        'inventory',
      );

      const [updated] = await db
        .update(schema.inventory)
        .set(validated)
        .where(eq(schema.inventory.id, id))
        .returning();

      return this.ensureExists(updated as Inventory, 'Inventory');
    } catch (err) {
      return this.handleError(err, 'updating inventory');
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                             READ/QUERY HELPERS                             */
  /* -------------------------------------------------------------------------- */

  async getInventoryById(id: number): Promise<Inventory | null> {
    try {
      const inventory = await db.query.inventory.findFirst({
        where: eq(schema.inventory.id, id),
      });
      return inventory ? (inventory as Inventory) : null;
    } catch (err) {
      return this.handleError(err, 'getting inventory by ID');
    }
  }

  async getInventoryByProduct(
    productId: number,
    storeId?: number,
  ): Promise<Inventory | null> {
    try {
      const inventory = await db.query.inventory.findFirst({
        where: and(
          eq(schema.inventory.productId, productId),
          storeId ? eq(schema.inventory.storeId, storeId) : undefined,
        ),
      });
      return inventory ? (inventory as Inventory) : null;
    } catch (err) {
      return this.handleError(err, 'getting inventory by product');
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                             INVENTORY ITEMS                                */
  /* -------------------------------------------------------------------------- */

  async createInventoryItem(
    params: CreateInventoryItemParams,
  ): Promise<InventoryItem> {
    try {
      const inventory = await this.getInventoryById(params.inventoryId);
      if (!inventory) throw InventoryServiceErrors.INVENTORY_NOT_FOUND;

      const product = await this.getProductById(params.productId);
      if (!product) throw InventoryServiceErrors.PRODUCT_NOT_FOUND;

      const data = {
        ...params,
        sku: params.sku ?? `SKU-${params.productId}-${Date.now()}`,
        quantity: params.quantity ?? 0,
        reorderLevel: params.reorderLevel ?? 0,
        reorderQuantity: params.reorderQuantity ?? 0,
        receivedDate: params.receivedDate ?? new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      };

      const validated = validateEntity(
        inventoryValidation.itemInsert,
        data,
        'inventory_item',
      );

      const [item] = await db
        .insert(schema.inventoryItems)
        .values(validated)
        .returning();

      await this.updateInventoryUtilization(params.inventoryId);
      return this.ensureExists(item, 'Inventory Item') as unknown as InventoryItem;
    } catch (err) {
      return this.handleError(err, 'creating inventory item');
    }
  }

  async updateInventoryItem(
    itemId: number,
    params: UpdateInventoryItemParams,
  ): Promise<InventoryItem> {
    try {
      const existing = await this.getInventoryItemById(itemId);
      if (!existing) {
      // TODO: Add specific error code 'INVENTORY_ITEM_NOT_FOUND' to InventoryServiceErrors.
      throw InventoryServiceErrors.INVENTORY_NOT_FOUND as unknown as 'INVENTORY_ITEM_NOT_FOUND';
    }

      const data = {
        ...params,
        updatedAt: new Date(),
        metadata: params.metadata
          ? JSON.stringify(params.metadata)
          : existing.metadata,
      };

      const validated = validateEntity(
        inventoryValidation.itemUpdate,
        data,
        'inventory_item',
      );

      const [updated] = await db
        .update(schema.inventoryItems)
        .set(validated)
        .where(eq(schema.inventoryItems.id, itemId))
        .returning();

      if (
        params.quantity !== undefined &&
        params.quantity !== existing.quantity
      ) {
        await this.updateInventoryUtilization(existing.inventoryId);
      }

      return this.ensureExists(updated, 'Inventory Item') as unknown as InventoryItem;
    } catch (err) {
      return this.handleError(err, 'updating inventory item');
    }
  }

  async getInventoryItemById(id: number): Promise<InventoryItem | null> {
    try {
      const item = await db.query.inventoryItems.findFirst({
        where: eq(schema.inventoryItems.id, id),
      });

      if (!item) {
        return null;
      }

      const product = await this.getProductById(item.productId);

      return {
        ...item,
        sku: item.sku ?? undefined,
        name: product?.name || '',
        unit: product?.unit || '',
        unitCost: product?.cost || '0',
        isActive: product?.isActive || false,
        reorderLevel: item.reorderLevel || 0,
        reorderQuantity: item.reorderQuantity || 0,
        createdAt: item.createdAt || new Date(),
        updatedAt: item.updatedAt || new Date(),
        metadata: item.metadata as Record<string, unknown>,
      };
    } catch (err) {
      return this.handleError(err, 'getting inventory item by ID');
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                             ADJUST / TRANSACT                              */
  /* -------------------------------------------------------------------------- */

  async adjustInventory(
    params: InventoryAdjustmentParams,
  ): Promise<boolean> {
    try {
      if (!params.inventoryId) {
        throw new Error("inventoryId is required");
      }
      const inventory = await this.getInventoryById(params.inventoryId);
      if (!inventory) throw InventoryServiceErrors.INVENTORY_NOT_FOUND;

      if (!params.itemId) {
        throw new Error("itemId is required");
      }
      const item = await this.getInventoryItemById(params.itemId);
      if (!item) throw InventoryServiceErrors.INVENTORY_NOT_FOUND;

      const beforeQty = item.quantity;
      const afterQty = beforeQty + params.quantity;

      if (params.quantity < 0 && afterQty < 0)
        throw InventoryServiceErrors.INSUFFICIENT_STOCK;

      await this.updateInventoryItem(item.id, { quantity: afterQty });

      const txData = {
        inventoryId: params.inventoryId,
        itemId: params.itemId,
        transactionType: params.transactionType ?? 'adjustment',
        quantity: params.quantity,
        beforeQuantity: beforeQty,
        afterQuantity: afterQty,
        unitCost: params.unitCost ?? item.unitCost,
        totalCost: (
          Number(params.unitCost ?? item.unitCost) * Math.abs(params.quantity)
        ).toFixed(2),
        referenceId: params.referenceId,
        notes: params.notes ?? '',
        performedBy: params.performedBy,
        transactionDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      };

      const validated = validateEntity(
        inventoryValidation.transactionInsert,
        txData,
        'inventory_transaction',
      );

      const [tx] = await db
        .insert(schema.inventoryTransactions)
        .values(validated)
        .returning();

      if (!params.inventoryId) {
        throw new Error("inventoryId is required");
      }
      await this.updateInventoryUtilization(params.inventoryId);
      this.ensureExists(tx, 'Inventory Transaction');
      return true;
    } catch (err) {
      return this.handleError(err, 'adjusting inventory');
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                         UTIL – INVENTORY VALUATION ETC                     */
  /* -------------------------------------------------------------------------- */

  private async updateInventoryUtilization(
    id: number,
  ): Promise<Inventory | null> {
    try {
      const [sumRow] = await db
        .select({
          total: sql<number>`sum(${schema.inventoryItems.quantity})`.mapWith(
            Number,
          ),
        })
        .from(schema.inventoryItems)
        .where(eq(schema.inventoryItems.inventoryId, id));

      const total = sumRow.total ?? 0;

      const [updated] = await db
        .update(schema.inventory)
        .set({ currentUtilization: total })
        .where(eq(schema.inventory.id, id))
        .returning();

      return updated as Inventory;
    } catch (err) {
      console.error('Error updating inventory utilization:', err);
      return null;
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                            INTERNAL LOOK-UPS                               */
  /* -------------------------------------------------------------------------- */

  private getProductById(productId: number) {
    return db.query.products.findFirst({
      where: eq(schema.products.id, productId),
    });
  }

  private getStoreById(storeId: number) {
    return db.query.stores.findFirst({
      where: eq(schema.stores.id, storeId),
    });
  }
}
