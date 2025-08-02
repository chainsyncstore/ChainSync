import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  decimal,
  uniqueIndex,
  pgEnum,
  jsonb
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { inventory } from './inventory'; // Assuming inventory items/batches are linked to main inventory
import { inventoryBatches } from './inventory'; // Assuming itemId refers to inventoryBatches
import { users } from './users';

// Using InventoryAdjustmentType from inventory/types.ts as the source of truth for transaction types
// This might need to be a shared enum if used in more places, or defined here.
// For now, assuming it's available or will be mapped.
// Let's define it here for self-containment of the DB schema file.
export const inventoryTransactionTypeEnum = pgEnum('inventory_transaction_type', [
  'purchase',
  'sale',
  'return',
  'damage',
  'loss',
  'transfer',
  'adjustment',
  'count',
  'receive'
]);

export const inventoryTransactions = pgTable('inventory_transactions', {
  _id: serial('id').primaryKey(),
  _inventoryId: integer('inventory_id')
    .references(() => inventory.id)
    .notNull(),
  _itemId: integer('item_id').references(() => inventoryBatches.id), // Assuming itemId refers to a batch/item
  _batchId: integer('batch_id').references(() => inventoryBatches.id), // Explicit batchId if different from itemId
  _transactionType: inventoryTransactionTypeEnum('transaction_type').notNull(),
  _quantity: integer('quantity').notNull(), // Can be positive (receive/return) or negative (sale/damage)
  _beforeQuantity: integer('before_quantity').notNull(),
  _afterQuantity: integer('after_quantity').notNull(),
  _unitCost: decimal('unit_cost', { _precision: 10, _scale: 2 }), // Cost at the time of transaction
  _totalCost: decimal('total_cost', { _precision: 10, _scale: 2 }), // quantity * unitCost
  _referenceId: text('reference_id'), // e.g., order_id, adjustment_id
  _notes: text('notes'),
  _performedBy: integer('performed_by').references(() => users.id), // User who performed the action
  _transactionDate: timestamp('transaction_date').notNull().defaultNow(),
  _createdAt: timestamp('created_at').notNull().defaultNow(),
  _updatedAt: timestamp('updated_at').notNull().defaultNow(),
  _metadata: jsonb('metadata')
});

// Zod schemas
export const inventoryTransactionInsertSchema = createInsertSchema(inventoryTransactions) as unknown as z.Schema;
export const inventoryTransactionSelectSchema = createSelectSchema(inventoryTransactions) as unknown as z.Schema;

export type InventoryTransaction = typeof inventoryTransactions.$inferSelect;
export type InventoryTransactionInsert = typeof inventoryTransactions.$inferInsert;

// Relations (optional, if needed)
// import { relations } from "drizzle-orm";
// export const inventoryTransactionsRelations = relations(inventoryTransactions, ({ one }) => ({
//   _inventory: one(inventory, { _fields: [inventoryTransactions.inventoryId], _references: [inventory.id] }),
//   _item: one(inventoryBatches, { _fields: [inventoryTransactions.itemId], _references: [inventoryBatches.id] }),
//   _user: one(users, { _fields: [inventoryTransactions.performedBy], _references: [users.id] }),
// }));
