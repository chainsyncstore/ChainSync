/**
 * Inventory Field Mapping Utilities
 * 
 * Module-specific mapping functions for the inventory domain.
 * These functions provide type-safe field mapping specifically for inventory-related data.
 */

import { toDatabaseFields, fromDatabaseFields } from './field-mapping';
import type { Inventory } from '../db/inventory';

// Define types for inventory-related entities if not already defined in the db file
type BatchInventory = {
  id: number;
  inventoryId: number;
  batchNumber: string;
  quantity: number;
  expirationDate?: Date;
  receivedDate: Date;
  cost: string;
  supplierId: number;
};

type InventoryTransaction = {
  id: number;
  inventoryId: number;
  quantity: number;
  type: 'addition' | 'deduction' | 'adjustment';
  reference: string;
  notes?: string;
  timestamp: Date;
  userId: number;
  batchId?: number;
};

/**
 * Maps an inventory item object from code (camelCase) to database (snake_case)
 * 
 * @param item The inventory item object with camelCase fields
 * @returns The inventory item object with snake_case fields for database operations
 */
export function inventoryItemToDatabaseFields(item: Partial<Inventory>): Record<string, unknown> {
  return toDatabaseFields(item);
}

/**
 * Maps an inventory item object from database (snake_case) to code (camelCase)
 * 
 * @param dbItem The inventory item object with snake_case fields from database
 * @returns The inventory item object with camelCase fields for code usage
 */
export function inventoryItemFromDatabaseFields<T extends Record<string, unknown>>(dbItem: T): Partial<Inventory> {
  return fromDatabaseFields(dbItem) as Partial<Inventory>;
}

/**
 * Maps a batch inventory object from code (camelCase) to database (snake_case)
 * 
 * @param batch The batch inventory object with camelCase fields
 * @returns The batch inventory object with snake_case fields for database operations
 */
export function batchInventoryToDatabaseFields(batch: Partial<BatchInventory>): Record<string, unknown> {
  return toDatabaseFields(batch);
}

/**
 * Maps a batch inventory object from database (snake_case) to code (camelCase)
 * 
 * @param dbBatch The batch inventory object with snake_case fields from database
 * @returns The batch inventory object with camelCase fields for code usage
 */
export function batchInventoryFromDatabaseFields<T extends Record<string, unknown>>(dbBatch: T): Partial<BatchInventory> {
  return fromDatabaseFields(dbBatch) as Partial<BatchInventory>;
}

/**
 * Maps an inventory transaction object from code (camelCase) to database (snake_case)
 * 
 * @param transaction The inventory transaction object with camelCase fields
 * @returns The inventory transaction object with snake_case fields for database operations
 */
export function inventoryTransactionToDatabaseFields(transaction: Partial<InventoryTransaction>): Record<string, unknown> {
  return toDatabaseFields(transaction);
}

/**
 * Maps an inventory transaction object from database (snake_case) to code (camelCase)
 * 
 * @param dbTransaction The inventory transaction object with snake_case fields from database
 * @returns The inventory transaction object with camelCase fields for code usage
 */
export function inventoryTransactionFromDatabaseFields<T extends Record<string, unknown>>(dbTransaction: T): Partial<InventoryTransaction> {
  return fromDatabaseFields(dbTransaction) as Partial<InventoryTransaction>;
}

/**
 * Maps an array of inventory objects from database to code format
 * 
 * @param dbItems Array of inventory objects from database
 * @param mapFn The mapping function to use
 * @returns Array of inventory objects formatted for code usage
 */
export function mapInventoryArray<T extends Record<string, unknown>, R>(
  dbItems: T[], 
  mapFn: (item: T) => R
): R[] {
  return dbItems.map(mapFn);
}

/**
 * Creates an inventory filter with properly formatted database field names
 * 
 * @param filter Filter criteria in camelCase
 * @returns Filter criteria with snake_case field names for database queries
 */
export function createInventoryDbFilter<T>(filter: Partial<T>): Record<string, unknown> {
  return toDatabaseFields(filter);
}
