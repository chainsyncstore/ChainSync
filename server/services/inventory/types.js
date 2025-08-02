'use strict';
/**
 * Inventory Service Types
 *
 * This file defines the interfaces and types for the inventory service.
 */
Object.defineProperty(exports, '__esModule', { value: true });
exports.InventoryServiceErrors = exports.InventoryAdjustmentType = exports.InventoryTransactionType = void 0;
let InventoryTransactionType;
(function(InventoryTransactionType) {
  InventoryTransactionType['PURCHASE'] = 'purchase';
  InventoryTransactionType['SALE'] = 'sale';
  InventoryTransactionType['RECEIVE'] = 'receive';
  InventoryTransactionType['RETURN'] = 'return';
  InventoryTransactionType['DAMAGE'] = 'damage';
  InventoryTransactionType['LOSS'] = 'loss';
  InventoryTransactionType['TRANSFER'] = 'transfer';
  InventoryTransactionType['ADJUSTMENT'] = 'adjustment';
  InventoryTransactionType['COUNT'] = 'count';
})(InventoryTransactionType || (exports.InventoryTransactionType = InventoryTransactionType = {}));
// Alias to maintain backwards compatibility
let InventoryAdjustmentType;
(function(InventoryAdjustmentType) {
  InventoryAdjustmentType['PURCHASE'] = 'purchase';
  InventoryAdjustmentType['SALE'] = 'sale';
  InventoryAdjustmentType['RETURN'] = 'return';
  InventoryAdjustmentType['DAMAGE'] = 'damage';
  InventoryAdjustmentType['LOSS'] = 'loss';
  InventoryAdjustmentType['TRANSFER'] = 'transfer';
  InventoryAdjustmentType['ADJUSTMENT'] = 'adjustment';
  InventoryAdjustmentType['COUNT'] = 'count';
})(InventoryAdjustmentType || (exports.InventoryAdjustmentType = InventoryAdjustmentType = {}));
exports.InventoryServiceErrors = {
  INVENTORY_NOT_FOUND: new Error('Inventory record not found'),
  PRODUCT_NOT_FOUND: new Error('Product not found'),
  STORE_NOT_FOUND: new Error('Store not found'),
  BATCH_NOT_FOUND: new Error('Inventory batch not found'),
  INSUFFICIENT_STOCK: new Error('Insufficient stock available'),
  INVALID_ADJUSTMENT: new Error('Invalid inventory adjustment'),
  INVALID_BATCH_OPERATION: new Error('Invalid batch operation')
};
