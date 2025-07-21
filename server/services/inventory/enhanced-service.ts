/**
 * Enhanced Inventory Service
 *
 * A refactored version of the Inventory service that uses the enhanced base service
 * and utility abstractions to reduce code duplication and improve type safety.
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
} from './types';
import { InventoryServiceErrors } from './errors';
import { db } from '@server/db';
import { sql, eq, and, or, like, desc, asc } from 'drizzle-orm';
import * as schema from '@shared/schema';

export class EnhancedInventoryService extends EnhancedBaseService implements IInventoryService {
  private inventoryFormatter: InventoryFormatter;
  private itemFormatter: InventoryItemFormatter;
  private transactionFormatter: InventoryTransactionFormatter;

  constructor() {
    super();
    this.inventoryFormatter = new InventoryFormatter();
    this.itemFormatter = new InventoryItemFormatter();
    this.transactionFormatter = new InventoryTransactionFormatter();
  }

  async createInventory(params: CreateInventoryParams): Promise<Inventory> {
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
        return this.updateInventory(existingInventory.id, params);
      }

      const inventoryData = {
        ...params,
        currentUtilization: params.currentUtilization || 0,
        lastAuditDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      };

      const validatedData = validateEntity(inventoryValidation.insert, inventoryData, 'inventory');

      const [inventory] = await db.insert(schema.inventory).values(validatedData).returning();

      return this.ensureExists(inventory, 'Inventory');
    } catch (error) {
      return this.handleError(error, 'creating inventory');
    }
  }

  async updateInventory(inventoryId: number, params: UpdateInventoryParams): Promise<Inventory> {
    try {
      const existingInventory = await this.getInventoryById(inventoryId);
      if (!existingInventory) {
        throw InventoryServiceErrors.INVENTORY_NOT_FOUND;
      }

      const updateData = {
        ...params,
        updatedAt: new Date(),
        metadata: params.metadata ? JSON.stringify(params.metadata) : existingInventory.metadata,
      };

      const validatedData = validateEntity(inventoryValidation.update, updateData, 'inventory');

      const [updatedInventory] = await db.update(schema.inventory).set(validatedData).where(eq(schema.inventory.id, inventoryId)).returning();

      return this.ensureExists(updatedInventory, 'Inventory');
    } catch (error) {
      return this.handleError(error, 'updating inventory');
    }
  }

  async getInventoryById(inventoryId: number): Promise<Inventory | null> {
    try {
      return await db.query.inventory.findFirst({
        where: eq(schema.inventory.id, inventoryId),
      });
    } catch (error) {
      return this.handleError(error, 'getting inventory by ID');
    }
  }

  async getInventoryByProduct(productId: number, storeId?: number): Promise<Inventory | null> {
    try {
      return await db.query.inventory.findFirst({
        where: and(
          eq(schema.inventory.productId, productId),
          storeId ? eq(schema.inventory.storeId, storeId) : undefined
        ),
      });
    } catch (error) {
      return this.handleError(error, 'getting inventory by product');
    }
  }

  async createInventoryItem(params: CreateInventoryItemParams): Promise<InventoryItem> {
    try {
      const inventory = await this.getInventoryById(params.inventoryId);
      if (!inventory) {
        throw InventoryServiceErrors.INVENTORY_NOT_FOUND;
      }

      const product = await this.getProductById(params.productId);
      if (!product) {
        throw InventoryServiceErrors.PRODUCT_NOT_FOUND;
      }

      const itemData = {
        ...params,
        sku: params.sku || `SKU-${params.productId}-${Date.now()}`,
        quantity: params.quantity || 0,
        reorderLevel: params.reorderLevel || 0,
        reorderQuantity: params.reorderQuantity || 0,
        receivedDate: params.receivedDate || new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      };

      const validatedData = validateEntity(inventoryValidation.itemInsert, itemData, 'inventory_item');

      const [item] = await db.insert(schema.inventoryItems).values(validatedData).returning();

      await this.updateInventoryUtilization(params.inventoryId);

      return this.ensureExists(item, 'Inventory Item');
    } catch (error) {
      return this.handleError(error, 'creating inventory item');
    }
  }

  async updateInventoryItem(
    itemId: number,
    params: UpdateInventoryItemParams
  ): Promise<InventoryItem> {
    try {
      const existingItem = await this.getInventoryItemById(itemId);
      if (!existingItem) {
        throw InventoryServiceErrors.ITEM_NOT_FOUND;
      }

      const updateData = {
        ...params,
        updatedAt: new Date(),
        metadata: params.metadata ? JSON.stringify(params.metadata) : existingItem.metadata,
      };

      const validatedData = validateEntity(inventoryValidation.itemUpdate, updateData, 'inventory_item');

      const [updatedItem] = await db.update(schema.inventoryItems).set(validatedData).where(eq(schema.inventoryItems.id, itemId)).returning();

      if (params.quantity !== undefined && params.quantity !== existingItem.quantity) {
        await this.updateInventoryUtilization(existingItem.inventoryId);
      }

      return this.ensureExists(updatedItem, 'Inventory Item');
    } catch (error) {
      return this.handleError(error, 'updating inventory item');
    }
  }

  async getInventoryItemById(itemId: number): Promise<InventoryItem | null> {
    try {
      return await db.query.inventoryItems.findFirst({
        where: eq(schema.inventoryItems.id, itemId),
      });
    } catch (error) {
      return this.handleError(error, 'getting inventory item by ID');
    }
  }

  async getInventoryItems(inventoryId: number): Promise<InventoryItem[]> {
    try {
      return await db.query.inventoryItems.findMany({
        where: eq(schema.inventoryItems.inventoryId, inventoryId),
        orderBy: [desc(schema.inventoryItems.createdAt)],
      });
    } catch (error) {
      return this.handleError(error, 'getting inventory items');
    }
  }

  async adjustInventory(params: InventoryAdjustmentParams): Promise<boolean> {
    try {
      const inventory = await this.getInventoryById(params.inventoryId);
      if (!inventory) {
        throw InventoryServiceErrors.INVENTORY_NOT_FOUND;
      }

      const item = await this.getInventoryItemById(params.itemId);
      if (!item) {
        throw InventoryServiceErrors.ITEM_NOT_FOUND;
      }

      const quantity = params.quantity;
      const beforeQuantity = item.quantity;
      const afterQuantity = beforeQuantity + quantity;

      if (quantity < 0 && afterQuantity < 0) {
        throw InventoryServiceErrors.INSUFFICIENT_STOCK;
      }

      await this.updateInventoryItem(item.id, {
        quantity: afterQuantity,
      });

      const transactionData = {
        inventoryId: params.inventoryId,
        itemId: params.itemId,
        transactionType: params.transactionType || 'adjustment',
        quantity,
        beforeQuantity,
        afterQuantity,
        unitCost: params.unitCost || item.unitCost,
        totalCost: (Number(params.unitCost || item.unitCost) * Math.abs(quantity)).toFixed(2),
        referenceId: params.referenceId,
        notes: params.notes || '',
        performedBy: params.performedBy,
        transactionDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      };

      const validatedData = validateEntity(inventoryValidation.transactionInsert, transactionData, 'inventory_transaction');

      const [transaction] = await db.insert(schema.inventoryTransactions).values(validatedData).returning();

      await this.updateInventoryUtilization(params.inventoryId);

      this.ensureExists(transaction, 'Inventory Transaction');
      return true;
    } catch (error) {
      return this.handleError(error, 'adjusting inventory');
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
          storeId: params.storeId || 1,
          totalQuantity: params.quantity,
          availableQuantity: params.quantity,
          minimumLevel: 0,
          batchTracking: true,
        });
      }

      if (!inventory.batchTracking) {
        await this.updateInventory(inventory.id, {
          batchTracking: true,
        });
      }

      const batchItemParams: CreateInventoryItemParams = {
        inventoryId: inventory.id,
        productId: params.productId,
        name: product.name,
        description: product.description || '',
        sku: params.sku || `BATCH-${params.productId}-${Date.now()}`,
        quantity: params.quantity,
        unit: params.unit || 'each',
        unitCost: params.unitCost || 0,
        batchNumber: params.batchNumber || `B${Date.now()}`,
        manufactureDate: params.manufactureDate,
        expiryDate: params.expiryDate,
        supplier: params.supplier,
        isActive: true,
        metadata: params.metadata,
      };

      const batchItem = await this.createInventoryItem(batchItemParams);

      await this.adjustInventory({
        inventoryId: inventory.id,
        itemId: batchItem.id,
        quantity: params.quantity,
        transactionType: InventoryTransactionType.RECEIVE,
        unitCost: String(params.unitCost),
        referenceId: params.referenceId,
        notes: `Batch ${params.batchNumber || batchItem.batchNumber} received`,
        performedBy: params.userId,
      });

      return batchItem;
    } catch (error) {
      return this.handleError(error, 'adding inventory batch');
    }
  }

  async getTransactionById(transactionId: number): Promise<InventoryTransaction | null> {
    try {
      return await db.query.inventoryTransactions.findFirst({
        where: eq(schema.inventoryTransactions.id, transactionId),
      });
    } catch (error) {
      return this.handleError(error, 'getting transaction by ID');
    }
  }

  async getTransactionsByInventory(inventoryId: number): Promise<InventoryTransaction[]> {
    try {
      return await db.query.inventoryTransactions.findMany({
        where: eq(schema.inventoryTransactions.inventoryId, inventoryId),
        orderBy: [desc(schema.inventoryTransactions.transactionDate)],
      });
    } catch (error) {
      return this.handleError(error, 'getting transactions by inventory');
    }
  }

  async getTransactionsByItem(itemId: number): Promise<InventoryTransaction[]> {
    try {
      return await db.query.inventoryTransactions.findMany({
        where: eq(schema.inventoryTransactions.itemId, itemId),
        orderBy: [desc(schema.inventoryTransactions.transactionDate)],
      });
    } catch (error) {
      return this.handleError(error, 'getting transactions by item');
    }
  }

  private async updateInventoryUtilization(inventoryId: number): Promise<Inventory | null> {
    try {
      const result = await db
        .select({
          totalQuantity: sql<number>`sum(${schema.inventoryItems.quantity})`.mapWith(Number),
        })
        .from(schema.inventoryItems)
        .where(eq(schema.inventoryItems.inventoryId, inventoryId));

      const totalQuantity = result[0].totalQuantity || 0;

      const [updatedInventory] = await db.update(schema.inventory).set({ currentUtilization: totalQuantity }).where(eq(schema.inventory.id, inventoryId)).returning();
      return updatedInventory;
    } catch (error) {
      console.error(`Error updating inventory utilization: ${error}`);
      return null;
    }
  }

  private async getProductById(productId: number): Promise<any> {
    try {
      return await db.query.products.findFirst({
        where: eq(schema.products.id, productId),
      });
    } catch (error) {
      return null;
    }
  }

  private async getStoreById(storeId: number): Promise<any> {
    try {
      return await db.query.stores.findFirst({
        where: eq(schema.stores.id, storeId),
      });
    } catch (error) {
      return null;
    }
  }

  async getInventoryByStore(storeId: number, page?: number, limit?: number): Promise<{ inventory: Inventory[]; total: number; page: number; limit: number; }> {
    throw new Error('Method not implemented.');
  }
  async searchInventory(params: InventorySearchParams): Promise<{ inventory: Inventory[]; total: number; page: number; limit: number; }> {
    throw new Error('Method not implemented.');
  }
  async getBatchesByProduct(productId: number): Promise<schema.InventoryBatch[]> {
    throw new Error('Method not implemented.');
  }
  async getLowStockItems(storeId: number): Promise<Inventory[]> {
    throw new Error('Method not implemented.');
  }
  async getInventoryValuation(storeId: number): Promise<{ totalValue: string; totalItems: number; valuationDate: Date; breakdown: { categoryId: number; categoryName: string; value: string; itemCount: number; }[]; }> {
    throw new Error('Method not implemented.');
  }
}
