/**
 * Inventory Service
 * Strictly typed, relation-free queries to avoid Drizzle type mismatches.
 */

import { BaseService } from '../base/service.js';
import {
  IInventoryService,
  InventoryServiceErrors,
  CreateInventoryParams,
  UpdateInventoryParams,
  InventoryAdjustmentParams,
  InventoryBatchParams,
  InventorySearchParams,
  InventoryAdjustmentType,
} from './types.js';

import { db } from '@db';
import * as schema from '@shared/schema';
import {
  eq,
  and,
  desc,
  asc,
  gt,
  sql,
  like,
  or,
} from 'drizzle-orm';
import {
  inventoryValidation,
  SchemaValidationError,
} from '@shared/schema-validation';

export class InventoryService extends BaseService implements IInventoryService {
  /* ---------------------------------------------------------- CREATE --------------------------------------------------------- */

  async createInventory(
    params: CreateInventoryParams,
  ): Promise<schema.Inventory> {
    try {
      // 1. Validate FK existence ------------------------------------------------------------------
      const product = await db.query.products.findFirst({
        where: eq(schema.products.id, params.productId),
      });
      if (!product) throw InventoryServiceErrors.PRODUCT_NOT_FOUND;

      const store = await db.query.stores.findFirst({
        where: eq(schema.stores.id, params.storeId),
      });
      if (!store) throw InventoryServiceErrors.STORE_NOT_FOUND;

      // 2. Prevent duplicates ---------------------------------------------------------------------
      const existing = await db.query.inventory.findFirst({
        where: and(
          eq(schema.inventory.productId, params.productId),
          eq(schema.inventory.storeId, params.storeId),
        ),
      });
      if (existing) {
        return this.updateInventory(existing.id, params);
      }

      // 3. Prepare & validate ---------------------------------------------------------------------
      const data = inventoryValidation.insert({
        productId: params.productId,
        storeId: params.storeId,
        totalQuantity: params.totalQuantity,
        availableQuantity: params.availableQuantity,
        minimumLevel: params.minimumLevel,
        batchTracking: params.batchTracking ?? false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // 4. Insert ----------------------------------------------------------------------------------
      const [inventory] = await db
        .insert(schema.inventory)
        .values(data)
        .returning();
      return inventory;
    } catch (err) {
      if (err instanceof SchemaValidationError) {
        console.error('Validation error:', err.toJSON());
      }
      return this.handleError(err, 'createInventory');
    }
  }

  /* ---------------------------------------------------------- UPDATE --------------------------------------------------------- */

  async updateInventory(
    inventoryId: number,
    params: UpdateInventoryParams,
  ): Promise<schema.Inventory> {
    try {
      const existing = await db.query.inventory.findFirst({
        where: eq(schema.inventory.id, inventoryId),
      });
      if (!existing) throw InventoryServiceErrors.INVENTORY_NOT_FOUND;

      const data = inventoryValidation.update({
        ...params,
        updatedAt: new Date(),
      });

      const [updated] = await db
        .update(schema.inventory)
        .set(data)
        .where(eq(schema.inventory.id, inventoryId))
        .returning();
      return updated;
    } catch (err) {
      if (err instanceof SchemaValidationError) {
        console.error('Validation error:', err.toJSON());
      }
      return this.handleError(err, 'updateInventory');
    }
  }

  /* ---------------------------------------------------------- READ ----------------------------------------------------------- */

  async getInventoryByProduct(
    productId: number,
  ): Promise<schema.Inventory | null> {
    try {
      return await db.query.inventory.findFirst({
        where: eq(schema.inventory.productId, productId),
      });
    } catch (err) {
      return this.handleError(err, 'getInventoryByProduct');
    }
  }

  async getInventoryByStore(
    storeId: number,
    page = 1,
    limit = 20,
  ): Promise<{
    inventory: schema.Inventory[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const store = await db.query.stores.findFirst({
        where: eq(schema.stores.id, storeId),
      });
      if (!store) throw InventoryServiceErrors.STORE_NOT_FOUND;

      const offset = (page - 1) * limit;

      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.inventory)
        .where(eq(schema.inventory.storeId, storeId));

      const inventory = await db.query.inventory.findMany({
        where: eq(schema.inventory.storeId, storeId),
        offset,
        limit,
        orderBy: [desc(schema.inventory.updatedAt)],
      });

      return {
        inventory,
        total: Number(countRow?.count ?? 0),
        page,
        limit,
      };
    } catch (err) {
      return this.handleError(err, 'getInventoryByStore');
    }
  }

  async searchInventory(
    params: InventorySearchParams,
  ): Promise<{
    inventory: schema.Inventory[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const { page = 1, limit = 20 } = params;
      const offset = (page - 1) * limit;

      /* ---------- Where clause construction ---------- */
      let where = eq(schema.inventory.storeId, params.storeId);

      if (params.productId) {
        where = and(
          where,
          eq(schema.inventory.productId, params.productId),
        );
      }
      if (params.keyword) {
        const kw = `%${params.keyword}%`;
        where = and(
          where,
          or(
            like(schema.inventory.id, kw),
            like(schema.inventory.totalQuantity, kw as never), // example extra search
          ),
        );
      }

      /* ---------- Sorting ---------- */
      const dir = params.sortDirection === 'asc' ? asc : desc;
      const orderField = params.sortBy ?? 'updatedAt';
      const orderBy =
        orderField === 'quantity'
          ? dir(schema.inventory.availableQuantity)
          : dir(schema.inventory.updatedAt);

      /* ---------- Query ---------- */
      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.inventory)
        .where(where);

      const inventory = await db.query.inventory.findMany({
        where,
        offset,
        limit,
        orderBy: [orderBy],
      });

      return {
        inventory,
        total: Number(countRow?.count ?? 0),
        page,
        limit,
      };
    } catch (err) {
      return this.handleError(err, 'searchInventory');
    }
  }

  /* ------------------------------------------------------ ADJUST & BATCH ----------------------------------------------------- */

  async adjustInventory(
    params: InventoryAdjustmentParams,
  ): Promise<boolean> {
    try {
      return await db.transaction(async (tx) => {
        /* ---------- Load & checks ---------- */
        const inventory = await tx.query.inventory.findFirst({
          where: eq(schema.inventory.id, params.inventoryId),
        });
        if (!inventory) throw InventoryServiceErrors.INVENTORY_NOT_FOUND;

        const newAvailable = inventory.availableQuantity + params.quantity;
        if (newAvailable < 0)
          throw InventoryServiceErrors.INSUFFICIENT_STOCK;

        /* ---------- Update inventory ---------- */
        await tx
          .update(schema.inventory)
          .set({
            availableQuantity: newAvailable,
            updatedAt: new Date(),
          })
          .where(eq(schema.inventory.id, inventory.id));

        /* ---------- Insert adjustment log ---------- */
        await tx.insert(schema.inventoryAdjustments).values({
          inventoryId: inventory.id,
          quantity: params.quantity,
          previousQuantity: inventory.availableQuantity,
          newQuantity: newAvailable,
          transactionType: params.transactionType,
          reason: params.reason,
          userId: params.userId,
          batchId: params.batchId,
          referenceId: params.referenceId,
          notes: params.notes,
          unitCost: params.unitCost,
          createdAt: new Date(),
        });

        /* ---------- If batch tracking ---------- */
        if (params.batchId) {
          const batch = await tx.query.inventoryBatches.findFirst({
            where: eq(schema.inventoryBatches.id, params.batchId),
          });
          if (!batch) throw InventoryServiceErrors.BATCH_NOT_FOUND;

          const newBatchQty = batch.quantity + params.quantity;
          if (newBatchQty < 0)
            throw InventoryServiceErrors.INSUFFICIENT_STOCK;

          await tx
            .update(schema.inventoryBatches)
            .set({
              quantity: newBatchQty,
              updatedAt: new Date(),
            })
            .where(eq(schema.inventoryBatches.id, params.batchId));
        }

        return true;
      });
    } catch (err) {
      if (err instanceof SchemaValidationError) {
        console.error('Validation error:', err.toJSON());
      }
      return this.handleError(err, 'adjustInventory');
    }
  }

  async addInventoryBatch(
    params: InventoryBatchParams,
  ): Promise<schema.InventoryBatch> {
    try {
      return await db.transaction(async (tx) => {
        /* ---------- Ensure inventory exists / enable tracking ---------- */
        let inventory = await tx.query.inventory.findFirst({
          where: and(
            eq(schema.inventory.productId, params.productId),
            eq(schema.inventory.storeId, params.storeId),
          ),
        });

        if (!inventory) {
          const [created] = await tx
            .insert(schema.inventory)
            .values({
              productId: params.productId,
              storeId: params.storeId,
              totalQuantity: 0,
              availableQuantity: 0,
              minimumLevel: 10,
              batchTracking: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();
          inventory = created;
        } else if (!inventory.batchTracking) {
          await tx
            .update(schema.inventory)
            .set({ batchTracking: true, updatedAt: new Date() })
            .where(eq(schema.inventory.id, inventory.id));
        }

        /* ---------- Insert batch ---------- */
        const [batch] = await tx
          .insert(schema.inventoryBatches)
          .values({
            inventoryId: inventory.id,
            batchNumber:
              params.batchNumber ?? `BATCH-${Date.now().toString(36)}`,
            quantity: params.quantity,
            costPerUnit: params.unitCost,
            receivedDate: params.purchaseDate,
            expiryDate: params.expiryDate,
            supplierId: params.supplier ?? undefined,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        /* ---------- Adjustment log ---------- */
        await this.adjustInventory({
          inventoryId: inventory.id,
          quantity: params.quantity,
          transactionType: InventoryAdjustmentType.PURCHASE,
          reason: 'Batch added',
          userId: params.userId,
          batchId: batch.id,
          referenceId: params.supplierReference,
          notes: params.notes,
          unitCost: params.unitCost,
        });

        return batch;
      });
    } catch (err) {
      if (err instanceof SchemaValidationError) {
        console.error('Validation error:', err.toJSON());
      }
      return this.handleError(err, 'addInventoryBatch');
    }
  }

  /* ------------------------------------------------------- EXTRA ------------------------------------------------------------ */

  async getBatchesByProduct(
    productId: number,
  ): Promise<schema.InventoryBatch[]> {
    try {
      return await db.query.inventoryBatches.findMany({
        where: eq(schema.inventoryBatches.productId, productId),
        orderBy: [desc(schema.inventoryBatches.receivedDate)],
      });
    } catch (err) {
      return this.handleError(err, 'getBatchesByProduct');
    }
  }

  async getLowStockItems(storeId: number): Promise<schema.Inventory[]> {
    try {
      const store = await db.query.stores.findFirst({
        where: eq(schema.stores.id, storeId),
      });
      if (!store) throw InventoryServiceErrors.STORE_NOT_FOUND;

      return await db.query.inventory.findMany({
        where: and(
          eq(schema.inventory.storeId, storeId),
          gt(schema.inventory.availableQuantity, 0),
          gt(schema.inventory.minimumLevel, schema.inventory.availableQuantity),
        ),
        orderBy: [asc(schema.inventory.availableQuantity)],
      });
    } catch (err) {
      return this.handleError(err, 'getLowStockItems');
    }
  }

  async getInventoryValuation(storeId: number): Promise<{
    totalValue: number;
    byCategory: Record<
      number, // categoryId
      { value: number; count: number; name: string }
    >;
  }> {
    try {
      const store = await db.query.stores.findFirst({
        where: eq(schema.stores.id, storeId),
      });
      if (!store) throw InventoryServiceErrors.STORE_NOT_FOUND;

      const inventory = await db.query.inventory.findMany({
        where: eq(schema.inventory.storeId, storeId),
        orderBy: [desc(schema.inventory.updatedAt)],
      });

      /* ---------- Valuation calc ---------- */
      let totalValue = 0;
      const byCategory = new Map<
        number,
        { value: number; count: number; name: string }
      >();

      for (const inv of inventory) {
        const product = await db.query.products.findFirst({
          where: eq(schema.products.id, inv.productId),
        });
        if (!product) continue;

        const value = inv.availableQuantity * Number(product.cost || 0);
        totalValue += value;

        const catId = product.categoryId ?? 0;
        const catName = 'Category' in product ? product.category!.name : 'N/A';

        if (!byCategory.has(catId)) {
          byCategory.set(catId, { value: 0, count: 0, name: catName });
        }
        const bucket = byCategory.get(catId)!;
        bucket.value += value;
        bucket.count += inv.availableQuantity;
      }

      return {
        totalValue,
        byCategory: Object.fromEntries(byCategory),
      };
    } catch (err) {
      return this.handleError(err, 'getInventoryValuation');
    }
  }
}