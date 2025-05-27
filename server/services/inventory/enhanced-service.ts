/**
 * Enhanced Inventory Service
 * 
 * A refactored version of the Inventory service that uses the enhanced base service
 * and utility abstractions to reduce code duplication and improve type safety.
 */
import { EnhancedBaseService } from '@server/services/base/enhanced-service';
import { 
  InventoryFormatter,
  InventoryItemFormatter,
  InventoryTransactionFormatter
} from './formatter';
import { inventoryValidation } from '@shared/schema-validation';
import { IInventoryService } from './interface';
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
  InventoryTransactionType
} from './types';
import { InventoryServiceErrors } from './errors';
import { ErrorCode } from '@shared/types/errors';
import { db } from '@server/db';
import { eq, and, or, like, desc, asc, sql } from 'drizzle-orm';
import * as schema from '@shared/schema';
import { formatDateForSql, formatJsonForSql } from '@shared/utils/sql-helpers';

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
  
  /**
   * Create a new inventory record with validated data
   * 
   * @param params Inventory creation parameters
   * @returns The created inventory record
   */
  async createInventory(params: CreateInventoryParams): Promise<Inventory> {
    try {
      // Check if product exists
      const product = await this.getProductById(params.productId);
      if (!product) {
        throw InventoryServiceErrors.PRODUCT_NOT_FOUND;
      }
      
      // Check if store exists
      const store = await this.getStoreById(params.storeId);
      if (!store) {
        throw InventoryServiceErrors.STORE_NOT_FOUND;
      }
      
      // Check for existing inventory for this product and store
      const existingInventory = await this.getInventoryByProduct(params.productId, params.storeId);
      if (existingInventory) {
        return this.updateInventory(existingInventory.id, params);
      }
      
      // Prepare inventory data
      const inventoryData = {
        ...params,
        currentUtilization: params.currentUtilization || 0,
        lastAuditDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: params.metadata ? JSON.stringify(params.metadata) : null
      };
      
      // Validate and prepare the data
      const validatedData = inventoryValidation.insert(inventoryData);
      
      // Use the raw insert method to avoid TypeScript field mapping errors
      const inventory = await this.rawInsertWithFormatting(
        'inventory',
        validatedData,
        this.inventoryFormatter.formatResult.bind(this.inventoryFormatter)
      );
      
      // Ensure the inventory was created
      return this.ensureExists(inventory, 'Inventory');
    } catch (error) {
      return this.handleError(error, 'creating inventory');
    }
  }
  
  /**
   * Update an inventory record with validated data
   * 
   * @param inventoryId ID of the inventory to update
   * @param params Inventory update parameters
   * @returns The updated inventory record
   */
  async updateInventory(inventoryId: number, params: UpdateInventoryParams): Promise<Inventory> {
    try {
      // Get existing inventory
      const existingInventory = await this.getInventoryById(inventoryId);
      if (!existingInventory) {
        throw InventoryServiceErrors.INVENTORY_NOT_FOUND;
      }
      
      // Prepare update data with proper field names
      const updateData = {
        ...params,
        updatedAt: new Date(),
        metadata: params.metadata ? JSON.stringify(params.metadata) : existingInventory.metadata
      };
      
      // Validate the data
      const validatedData = inventoryValidation.update(updateData);
      
      // Use the raw update method to avoid TypeScript field mapping errors
      const updatedInventory = await this.rawUpdateWithFormatting(
        'inventory',
        validatedData,
        `id = ${inventoryId}`,
        this.inventoryFormatter.formatResult.bind(this.inventoryFormatter)
      );
      
      // Ensure the inventory was updated
      return this.ensureExists(updatedInventory, 'Inventory');
    } catch (error) {
      return this.handleError(error, 'updating inventory');
    }
  }
  
  /**
   * Get an inventory record by ID
   * 
   * @param inventoryId ID of the inventory to retrieve
   * @returns The inventory record or null if not found
   */
  async getInventoryById(inventoryId: number): Promise<Inventory | null> {
    try {
      // Create a simple query to fetch the inventory
      const query = `
        SELECT * FROM inventory WHERE id = ${inventoryId}
      `;
      
      // Execute the query and format the result
      return await this.executeSqlWithFormatting(
        query,
        [],
        this.inventoryFormatter.formatResult.bind(this.inventoryFormatter)
      );
    } catch (error) {
      return this.handleError(error, 'getting inventory by ID');
    }
  }
  
  /**
   * Get an inventory record by product and store
   * 
   * @param productId ID of the product
   * @param storeId ID of the store
   * @returns The inventory record or null if not found
   */
  async getInventoryByProduct(productId: number, storeId?: number): Promise<Inventory | null> {
    try {
      // Create a query to fetch the inventory
      let query = `
        SELECT * FROM inventory 
        WHERE product_id = ${productId}
      `;
      
      if (storeId) {
        query += ` AND store_id = ${storeId}`;
      }
      
      query += ' LIMIT 1';
      
      // Execute the query and format the result
      return await this.executeSqlWithFormatting(
        query,
        [],
        this.inventoryFormatter.formatResult.bind(this.inventoryFormatter)
      );
    } catch (error) {
      return this.handleError(error, 'getting inventory by product');
    }
  }
  
  /**
   * Create an inventory item with validated data
   * 
   * @param params Inventory item creation parameters
   * @returns The created inventory item
   */
  async createInventoryItem(params: CreateInventoryItemParams): Promise<InventoryItem> {
    try {
      // Check if inventory exists
      const inventory = await this.getInventoryById(params.inventoryId);
      if (!inventory) {
        throw InventoryServiceErrors.INVENTORY_NOT_FOUND;
      }
      
      // Check if product exists
      const product = await this.getProductById(params.productId);
      if (!product) {
        throw InventoryServiceErrors.PRODUCT_NOT_FOUND;
      }
      
      // Prepare item data
      const itemData = {
        ...params,
        sku: params.sku || `SKU-${params.productId}-${Date.now()}`,
        quantity: params.quantity || 0,
        reorderLevel: params.reorderLevel || 0,
        reorderQuantity: params.reorderQuantity || 0,
        receivedDate: params.receivedDate || new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: params.metadata ? JSON.stringify(params.metadata) : null
      };
      
      // Validate and prepare the data
      const validatedData = inventoryValidation.itemInsert(itemData);
      
      // Use the raw insert method to avoid TypeScript field mapping errors
      const item = await this.rawInsertWithFormatting(
        'inventory_items',
        validatedData,
        this.itemFormatter.formatResult.bind(this.itemFormatter)
      );
      
      // Update inventory utilization
      await this.updateInventoryUtilization(params.inventoryId);
      
      // Ensure the item was created
      return this.ensureExists(item, 'Inventory Item');
    } catch (error) {
      return this.handleError(error, 'creating inventory item');
    }
  }
  
  /**
   * Update an inventory item with validated data
   * 
   * @param itemId ID of the item to update
   * @param params Inventory item update parameters
   * @returns The updated inventory item
   */
  async updateInventoryItem(itemId: number, params: UpdateInventoryItemParams): Promise<InventoryItem> {
    try {
      // Get existing item
      const existingItem = await this.getInventoryItemById(itemId);
      if (!existingItem) {
        throw InventoryServiceErrors.ITEM_NOT_FOUND;
      }
      
      // Prepare update data with proper field names
      const updateData = {
        ...params,
        updatedAt: new Date(),
        metadata: params.metadata ? JSON.stringify(params.metadata) : existingItem.metadata
      };
      
      // Validate the data
      const validatedData = inventoryValidation.itemUpdate(updateData);
      
      // Use the raw update method to avoid TypeScript field mapping errors
      const updatedItem = await this.rawUpdateWithFormatting(
        'inventory_items',
        validatedData,
        `id = ${itemId}`,
        this.itemFormatter.formatResult.bind(this.itemFormatter)
      );
      
      // Update inventory utilization if quantity changed
      if (params.quantity !== undefined && params.quantity !== existingItem.quantity) {
        await this.updateInventoryUtilization(existingItem.inventoryId);
      }
      
      // Ensure the item was updated
      return this.ensureExists(updatedItem, 'Inventory Item');
    } catch (error) {
      return this.handleError(error, 'updating inventory item');
    }
  }
  
  /**
   * Get an inventory item by ID
   * 
   * @param itemId ID of the item to retrieve
   * @returns The inventory item or null if not found
   */
  async getInventoryItemById(itemId: number): Promise<InventoryItem | null> {
    try {
      // Create a simple query to fetch the item
      const query = `
        SELECT * FROM inventory_items WHERE id = ${itemId}
      `;
      
      // Execute the query and format the result
      return await this.executeSqlWithFormatting(
        query,
        [],
        this.itemFormatter.formatResult.bind(this.itemFormatter)
      );
    } catch (error) {
      return this.handleError(error, 'getting inventory item by ID');
    }
  }
  
  /**
   * Get all inventory items for an inventory
   * 
   * @param inventoryId ID of the inventory
   * @returns Array of inventory items
   */
  async getInventoryItems(inventoryId: number): Promise<InventoryItem[]> {
    try {
      // Create a query to fetch the items
      const query = `
        SELECT * FROM inventory_items 
        WHERE inventory_id = ${inventoryId}
        ORDER BY created_at DESC
      `;
      
      // Execute the query and format the results
      return await this.executeSqlWithMultipleResults(
        query,
        [],
        this.itemFormatter.formatResult.bind(this.itemFormatter)
      );
    } catch (error) {
      return this.handleError(error, 'getting inventory items');
    }
  }
  
  /**
   * Adjust inventory quantity with transaction tracking
   * 
   * @param params Inventory adjustment parameters
   * @returns The created inventory transaction
   */
  async adjustInventory(params: InventoryAdjustmentParams): Promise<InventoryTransaction> {
    try {
      // Get inventory
      const inventory = await this.getInventoryById(params.inventoryId);
      if (!inventory) {
        throw InventoryServiceErrors.INVENTORY_NOT_FOUND;
      }
      
      // Get item
      const item = await this.getInventoryItemById(params.itemId);
      if (!item) {
        throw InventoryServiceErrors.ITEM_NOT_FOUND;
      }
      
      // Calculate new quantity
      const quantity = params.quantity;
      const beforeQuantity = item.quantity;
      const afterQuantity = beforeQuantity + quantity;
      
      // Check if sufficient stock for negative adjustments
      if (quantity < 0 && afterQuantity < 0) {
        throw InventoryServiceErrors.INSUFFICIENT_STOCK;
      }
      
      // Update item quantity
      await this.updateInventoryItem(item.id, {
        quantity: afterQuantity
      });
      
      // Prepare transaction data
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
        metadata: params.metadata ? JSON.stringify(params.metadata) : null
      };
      
      // Validate and prepare the data
      // TODO: Implement transactionInsert validation in inventoryValidation if needed
      const validatedData = transactionData; // Pass-through until validation is defined
      
      // Use the raw insert method to avoid TypeScript field mapping errors
      const transaction = await this.rawInsertWithFormatting(
        'inventory_transactions',
        validatedData,
        this.transactionFormatter.formatResult.bind(this.transactionFormatter)
      );
      
      // Update inventory utilization
      await this.updateInventoryUtilization(params.inventoryId);
      
      // Ensure the transaction was created
      return this.ensureExists(transaction, 'Inventory Transaction');
    } catch (error) {
      return this.handleError(error, 'adjusting inventory');
    }
  }
  
  /**
   * Add a new batch to inventory with batch tracking
   * 
   * @param params Inventory batch parameters
   * @returns The created inventory item for the batch
   */
  async addInventoryBatch(params: InventoryBatchParams): Promise<InventoryItem> {
    try {
      // Check if product exists
      const product = await this.getProductById(params.productId);
      if (!product) {
        throw InventoryServiceErrors.PRODUCT_NOT_FOUND;
      }
      
      // Get or create inventory
      let inventory = await this.getInventoryByProduct(params.productId, params.storeId);
      if (!inventory) {
        inventory = await this.createInventory({
          productId: params.productId,
          storeId: params.storeId || 1, // Default to main store if not specified
          name: product.name,
          description: product.description || '',
          batchTracking: true
        });
      }
      
      // Enable batch tracking if not already enabled
      if (!inventory.batchTracking) {
        await this.updateInventory(inventory.id, {
          batchTracking: true
        });
      }
      
      // Create the batch as an inventory item
      const batchItemParams: CreateInventoryItemParams = {
        inventoryId: inventory.id,
        productId: params.productId,
        name: product.name,
        description: product.description || '',
        sku: params.sku || `BATCH-${params.productId}-${Date.now()}`,
        quantity: params.quantity,
        unit: params.unit || 'each',
        unitCost: params.unitCost || '0.00',
        batchNumber: params.batchNumber || `B${Date.now()}`,
        manufactureDate: params.manufactureDate,
        expiryDate: params.expiryDate,
        supplier: params.supplier,
        isActive: true,
        metadata: params.metadata
      };
      
      // Create the batch item
      const batchItem = await this.createInventoryItem(batchItemParams);
      
      // Create a transaction record for the batch addition
      await this.adjustInventory({
        inventoryId: inventory.id,
        itemId: batchItem.id,
        quantity: params.quantity,
        transactionType: InventoryTransactionType.RECEIVE,
        unitCost: params.unitCost,
        referenceId: params.referenceId,
        notes: `Batch ${params.batchNumber || batchItem.batchNumber} received`,
        performedBy: params.performedBy
      });
      
      return batchItem;
    } catch (error) {
      return this.handleError(error, 'adding inventory batch');
    }
  }
  
  /**
   * Get a transaction by ID
   * 
   * @param transactionId ID of the transaction to retrieve
   * @returns The inventory transaction or null if not found
   */
  async getTransactionById(transactionId: number): Promise<InventoryTransaction | null> {
    try {
      // Create a simple query to fetch the transaction
      const query = `
        SELECT * FROM inventory_transactions WHERE id = ${transactionId}
      `;
      
      // Execute the query and format the result
      return await this.executeSqlWithFormatting(
        query,
        [],
        this.transactionFormatter.formatResult.bind(this.transactionFormatter)
      );
    } catch (error) {
      return this.handleError(error, 'getting transaction by ID');
    }
  }
  
  /**
   * Get all transactions for an inventory
   * 
   * @param inventoryId ID of the inventory
   * @returns Array of inventory transactions
   */
  async getTransactionsByInventory(inventoryId: number): Promise<InventoryTransaction[]> {
    try {
      // Create a query to fetch the transactions
      const query = `
        SELECT * FROM inventory_transactions 
        WHERE inventory_id = ${inventoryId}
        ORDER BY transaction_date DESC
      `;
      
      // Execute the query and format the results
      return await this.executeSqlWithMultipleResults(
        query,
        [],
        this.transactionFormatter.formatResult.bind(this.transactionFormatter)
      );
    } catch (error) {
      return this.handleError(error, 'getting transactions by inventory');
    }
  }
  
  /**
   * Get all transactions for an inventory item
   * 
   * @param itemId ID of the inventory item
   * @returns Array of inventory transactions
   */
  async getTransactionsByItem(itemId: number): Promise<InventoryTransaction[]> {
    try {
      // Create a query to fetch the transactions
      const query = `
        SELECT * FROM inventory_transactions 
        WHERE item_id = ${itemId}
        ORDER BY transaction_date DESC
      `;
      
      // Execute the query and format the results
      return await this.executeSqlWithMultipleResults(
        query,
        [],
        this.transactionFormatter.formatResult.bind(this.transactionFormatter)
      );
    } catch (error) {
      return this.handleError(error, 'getting transactions by item');
    }
  }
  
  /**
   * Update inventory utilization based on current item quantities
   * 
   * @param inventoryId ID of the inventory to update
   * @returns The updated inventory record
   */
  private async updateInventoryUtilization(inventoryId: number): Promise<Inventory | null> {
    try {
      // Get current total quantity across all items
      const query = `
        SELECT SUM(quantity) as total_quantity
        FROM inventory_items
        WHERE inventory_id = ${inventoryId}
      `;
      
      const result = await db.execute(sql.raw(query));
      const totalQuantity = Number(result.rows?.[0]?.total_quantity || 0);
      
      // Update inventory utilization
      return this.updateInventory(inventoryId, {
        currentUtilization: totalQuantity,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error(`Error updating inventory utilization: ${error}`);
      return null;
    }
  }
  
  /**
   * Helper method to get a product by ID
   * 
   * @param productId ID of the product
   * @returns The product or null if not found
   */
  private async getProductById(productId: number): Promise<any> {
    try {
      const result = await db.execute(
        sql.raw(`SELECT * FROM products WHERE id = ${productId} LIMIT 1`)
      );
      
      return result.rows?.[0] || null;
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Helper method to get a store by ID
   * 
   * @param storeId ID of the store
   * @returns The store or null if not found
   */
  private async getStoreById(storeId: number): Promise<any> {
    try {
      const result = await db.execute(
        sql.raw(`SELECT * FROM stores WHERE id = ${storeId} LIMIT 1`)
      );
      
      return result.rows?.[0] || null;
    } catch (error) {
      return null;
    }
  }
}
