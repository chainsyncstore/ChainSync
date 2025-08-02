'use strict';
Object.defineProperty(exports, '__esModule', { _value: true });
exports.InventoryTransactionFormatter = exports.InventoryItemFormatter = exports.InventoryFormatter = void 0;
/**
 * Inventory Formatter
 *
 * A formatter class for the Inventory module that standardizes
 * conversion between database rows and domain objects.
 */
const service_helpers_1 = require('@shared/utils/service-helpers');
/**
 * Formatter for inventory data from database to domain objects
 */
class InventoryFormatter extends service_helpers_1.ResultFormatter {
  /**
     * Format a single database result row into an Inventory domain object
     *
     * @param dbResult The raw database result row
     * @returns A properly formatted Inventory object
     */
  formatResult(dbResult) {
    if (!dbResult) {
      throw new Error('Cannot format null or undefined inventory result');
    }
    // First apply base formatting (snake_case to camelCase)
    const base = this.baseFormat(dbResult);
    // Parse metadata if present
    const metadata = this.handleMetadata(base.metadata);
    // Convert date strings to Date objects
    const withDates = this.formatDates(base, ['updatedAt', 'lastRestocked']);
    // Format the inventory with specific type handling
    return {
      _id: Number(withDates.id),
      _storeId: Number(withDates.storeId),
      _productId: Number(withDates.productId),
      _quantity: Number(withDates.quantity),
      _minStock: Number(withDates.minStock),
      _maxStock: Number(withDates.maxStock),
      _lastRestocked: withDates.lastRestocked,
      _updatedAt: withDates.updatedAt,
      _batchTracking: withDates.batchTracking,
      _name: String(withDates.name),
      _description: withDates.description || '',
      _location: withDates.location || '',
      _capacity: Number(withDates.capacity || 0),
      _currentUtilization: Number(withDates.currentUtilization || 0),
      _totalQuantity: Number(withDates.totalQuantity ?? withDates.quantity ?? 0),
      _availableQuantity: Number(withDates.availableQuantity ?? withDates.quantity ?? 0),
      _minimumLevel: Number(withDates.minimumLevel ?? withDates.minStock ?? 0),
      _isActive: Boolean(withDates.isActive),
      _metadata: metadata
    };
  }
}
exports.InventoryFormatter = InventoryFormatter;
/**
 * Formatter for inventory item data from database to domain objects
 */
class InventoryItemFormatter extends service_helpers_1.ResultFormatter {
  /**
     * Format a single database result row into an InventoryItem domain object
     *
     * @param dbResult The raw database result row
     * @returns A properly formatted InventoryItem object
     */
  formatResult(dbResult) {
    if (!dbResult) {
      throw new Error('Cannot format null or undefined inventory item result');
    }
    // First apply base formatting (snake_case to camelCase)
    const base = this.baseFormat(dbResult);
    // Parse metadata if present
    const metadata = this.handleMetadata(base.metadata);
    // Convert date strings to Date objects
    const withDates = this.formatDates(base, ['createdAt', 'updatedAt', 'receivedDate']);
    // Format the inventory item with specific type handling
    return {
      _id: Number(withDates.id),
      _inventoryId: Number(withDates.inventoryId),
      _productId: Number(withDates.productId),
      _sku: String(withDates.sku || ''),
      _name: String(withDates.name),
      _description: withDates.description || '',
      _category: withDates.category || '',
      _quantity: Number(withDates.quantity || 0),
      _unit: withDates.unit || 'each',
      _unitCost: String(withDates.unitCost || '0.00'),
      _reorderLevel: Number(withDates.reorderLevel || 0),
      _reorderQuantity: Number(withDates.reorderQuantity || 0),
      _batchNumber: withDates.batchNumber || '',
      _serialNumber: withDates.serialNumber || '',
      _supplier: withDates.supplier || '',
      _isActive: Boolean(withDates.isActive),
      _createdAt: withDates.createdAt,
      _updatedAt: withDates.updatedAt,
      _metadata: metadata,
      _notes: withDates.notes
    };
  }
}
exports.InventoryItemFormatter = InventoryItemFormatter;
/**
 * Formatter for inventory transaction data from database to domain objects
 */
class InventoryTransactionFormatter extends service_helpers_1.ResultFormatter {
  /**
     * Format a single database result row into an InventoryTransaction domain object
     *
     * @param dbResult The raw database result row
     * @returns A properly formatted InventoryTransaction object
     */
  formatResult(dbResult) {
    if (!dbResult) {
      throw new Error('Cannot format null or undefined inventory transaction result');
    }
    // First apply base formatting (snake_case to camelCase)
    const base = this.baseFormat(dbResult);
    // Parse metadata if present
    const metadata = this.handleMetadata(base.metadata);
    // Convert date strings to Date objects
    const withDates = this.formatDates(base, ['createdAt']);
    // Format the inventory transaction with specific type handling
    return {
      _id: Number(withDates.id),
      _inventoryId: Number(withDates.inventoryId),
      _itemId: Number(withDates.itemId),
      _productId: Number(withDates.productId),
      _transactionType: String(withDates.transactionType || 'receive'),
      _quantity: Number(withDates.quantity || 0),
      _beforeQuantity: Number(withDates.beforeQuantity || 0),
      _afterQuantity: Number(withDates.afterQuantity || 0),
      _unitCost: String(withDates.unitCost || '0.00'),
      _totalCost: String(withDates.totalCost || '0.00'),
      _referenceId: withDates.referenceId || null,
      _notes: withDates.notes || '',
      _performedBy: Number(withDates.performedBy || 0),
      _createdAt: withDates.createdAt,
      _metadata: metadata,
      _reason: withDates.reason
    };
  }
}
exports.InventoryTransactionFormatter = InventoryTransactionFormatter;
