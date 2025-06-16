/**
 * Inventory Formatter
 * 
 * A formatter class for the Inventory module that standardizes
 * conversion between database rows and domain objects.
 */
import { ResultFormatter } from '@shared/utils/service-helpers';
import { 
  Inventory, 
  InventoryItem, 
  InventoryTransaction,
  InventoryTransactionType
} from './types';

/**
 * Formatter for inventory data from database to domain objects
 */
export class InventoryFormatter extends ResultFormatter<Inventory> {
  /**
   * Format a single database result row into an Inventory domain object
   * 
   * @param dbResult The raw database result row
   * @returns A properly formatted Inventory object
   */
  formatResult(dbResult: Record<string, unknown>): Inventory {
    if (!dbResult) {
      throw new Error('Cannot format null or undefined inventory result');
    }
    
    // First apply base formatting (snake_case to camelCase)
    const base = this.baseFormat(dbResult);
    
    // Parse metadata if present
    const metadata = this.handleMetadata(base.metadata);
    
    // Convert date strings to Date objects
    const withDates = this.formatDates(
      base, 
      ['createdAt', 'updatedAt', 'lastAuditDate']
    );
    
    // Format the inventory with specific type handling
    return {
      ...withDates,
      id: Number(withDates.id),
      storeId: Number(withDates.storeId),
      name: String(withDates.name),
      description: withDates.description || '',
      location: withDates.location || '',
      capacity: Number(withDates.capacity || 0),
      currentUtilization: Number(withDates.currentUtilization || 0),
      isActive: Boolean(withDates.isActive),
      metadata: metadata
    };
  }
}

/**
 * Formatter for inventory item data from database to domain objects
 */
export class InventoryItemFormatter extends ResultFormatter<InventoryItem> {
  /**
   * Format a single database result row into an InventoryItem domain object
   * 
   * @param dbResult The raw database result row
   * @returns A properly formatted InventoryItem object
   */
  formatResult(dbResult: Record<string, unknown>): InventoryItem {
    if (!dbResult) {
      throw new Error('Cannot format null or undefined inventory item result');
    }
    
    // First apply base formatting (snake_case to camelCase)
    const base = this.baseFormat(dbResult);
    
    // Parse metadata if present
    const metadata = this.handleMetadata(base.metadata);
    
    // Convert date strings to Date objects
    const withDates = this.formatDates(
      base, 
      ['createdAt', 'updatedAt', 'expiryDate', 'manufactureDate', 'receivedDate']
    );
    
    // Format the inventory item with specific type handling
    return {
      ...withDates,
      id: Number(withDates.id),
      inventoryId: Number(withDates.inventoryId),
      productId: Number(withDates.productId),
      sku: String(withDates.sku || ''),
      name: String(withDates.name),
      description: withDates.description || '',
      category: withDates.category || '',
      quantity: Number(withDates.quantity || 0),
      unit: withDates.unit || 'each',
      unitCost: String(withDates.unitCost || '0.00'),
      reorderLevel: Number(withDates.reorderLevel || 0),
      reorderQuantity: Number(withDates.reorderQuantity || 0),
      batchNumber: withDates.batchNumber || '',
      serialNumber: withDates.serialNumber || '',
      supplier: withDates.supplier || '',
      isActive: Boolean(withDates.isActive),
      metadata: metadata
    };
  }
}

/**
 * Formatter for inventory transaction data from database to domain objects
 */
export class InventoryTransactionFormatter extends ResultFormatter<InventoryTransaction> {
  /**
   * Format a single database result row into an InventoryTransaction domain object
   * 
   * @param dbResult The raw database result row
   * @returns A properly formatted InventoryTransaction object
   */
  formatResult(dbResult: Record<string, unknown>): InventoryTransaction {
    if (!dbResult) {
      throw new Error('Cannot format null or undefined inventory transaction result');
    }
    
    // First apply base formatting (snake_case to camelCase)
    const base = this.baseFormat(dbResult);
    
    // Parse metadata if present
    const metadata = this.handleMetadata(base.metadata);
    
    // Convert date strings to Date objects
    const withDates = this.formatDates(
      base, 
      ['createdAt', 'updatedAt', 'transactionDate']
    );
    
    // Format the inventory transaction with specific type handling
    return {
      ...withDates,
      id: Number(withDates.id),
      inventoryId: Number(withDates.inventoryId),
      itemId: Number(withDates.itemId),
      transactionType: String(withDates.transactionType || 'receive') as InventoryTransactionType,
      quantity: Number(withDates.quantity || 0),
      beforeQuantity: Number(withDates.beforeQuantity || 0),
      afterQuantity: Number(withDates.afterQuantity || 0),
      unitCost: String(withDates.unitCost || '0.00'),
      totalCost: String(withDates.totalCost || '0.00'),
      referenceId: withDates.referenceId || null,
      notes: withDates.notes || '',
      performedBy: Number(withDates.performedBy || 0),
      metadata: metadata
    };
  }
}
