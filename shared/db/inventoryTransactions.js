"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inventoryTransactionSelectSchema = exports.inventoryTransactionInsertSchema = exports.inventoryTransactions = exports.inventoryTransactionTypeEnum = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_zod_1 = require("drizzle-zod");
const inventory_1 = require("./inventory"); // Assuming inventory items/batches are linked to main inventory
const inventory_2 = require("./inventory"); // Assuming itemId refers to inventoryBatches
const users_1 = require("./users");
// Using InventoryAdjustmentType from inventory/types.ts as the source of truth for transaction types
// This might need to be a shared enum if used in more places, or defined here.
// For now, assuming it's available or will be mapped.
// Let's define it here for self-containment of the DB schema file.
exports.inventoryTransactionTypeEnum = (0, pg_core_1.pgEnum)('inventory_transaction_type', [
    'purchase',
    'sale',
    'return',
    'damage',
    'loss',
    'transfer',
    'adjustment',
    'count',
    'receive',
]);
exports.inventoryTransactions = (0, pg_core_1.pgTable)('inventory_transactions', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    inventoryId: (0, pg_core_1.integer)('inventory_id')
        .references(() => inventory_1.inventory.id)
        .notNull(),
    itemId: (0, pg_core_1.integer)('item_id').references(() => inventory_2.inventoryBatches.id), // Assuming itemId refers to a batch/item
    batchId: (0, pg_core_1.integer)('batch_id').references(() => inventory_2.inventoryBatches.id), // Explicit batchId if different from itemId
    transactionType: (0, exports.inventoryTransactionTypeEnum)('transaction_type').notNull(),
    quantity: (0, pg_core_1.integer)('quantity').notNull(), // Can be positive (receive/return) or negative (sale/damage)
    beforeQuantity: (0, pg_core_1.integer)('before_quantity').notNull(),
    afterQuantity: (0, pg_core_1.integer)('after_quantity').notNull(),
    unitCost: (0, pg_core_1.decimal)('unit_cost', { precision: 10, scale: 2 }), // Cost at the time of transaction
    totalCost: (0, pg_core_1.decimal)('total_cost', { precision: 10, scale: 2 }), // quantity * unitCost
    referenceId: (0, pg_core_1.text)('reference_id'), // e.g., order_id, adjustment_id
    notes: (0, pg_core_1.text)('notes'),
    performedBy: (0, pg_core_1.integer)('performed_by').references(() => users_1.users.id), // User who performed the action
    transactionDate: (0, pg_core_1.timestamp)('transaction_date').notNull().defaultNow(),
    createdAt: (0, pg_core_1.timestamp)('created_at').notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').notNull().defaultNow(),
    metadata: (0, pg_core_1.jsonb)('metadata'),
});
// Zod schemas
exports.inventoryTransactionInsertSchema = (0, drizzle_zod_1.createInsertSchema)(exports.inventoryTransactions);
exports.inventoryTransactionSelectSchema = (0, drizzle_zod_1.createSelectSchema)(exports.inventoryTransactions);
// Relations (optional, if needed)
// import { relations } from "drizzle-orm";
// export const inventoryTransactionsRelations = relations(inventoryTransactions, ({ one }) => ({
//   inventory: one(inventory, { fields: [inventoryTransactions.inventoryId], references: [inventory.id] }),
//   item: one(inventoryBatches, { fields: [inventoryTransactions.itemId], references: [inventoryBatches.id] }),
//   user: one(users, { fields: [inventoryTransactions.performedBy], references: [users.id] }),
// }));
