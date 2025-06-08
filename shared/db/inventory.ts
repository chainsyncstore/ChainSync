import { relations } from 'drizzle-orm';
import {
  pgTable,
  serial,
  text,
  integer,
  decimal,
  timestamp,
  index,
  unique,
  boolean,
} from 'drizzle-orm/pg-core'; // Added boolean
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { baseTable, commonValidators } from './base.js';
import { products } from './products.js';
import { stores } from './stores.js';
import { suppliers } from './suppliers.js';

// Inventory status enum
export const inventoryStatus = z.enum(['available', 'low_stock', 'out_of_stock', 'reserved']);
export type InventoryStatus = z.infer<typeof inventoryStatus>;

// Inventory table
export const inventory = pgTable(
  'inventory',
  {
    id: serial('id').primaryKey(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
    storeId: integer('store_id')
      .references(() => stores.id)
      .notNull(),
    productId: integer('product_id')
      .references(() => products.id)
      .notNull(),
    totalQuantity: integer('total_quantity').notNull().default(0),
    minimumLevel: integer('minimum_level').notNull().default(0),
    status: text('status', { enum: inventoryStatus.options }).notNull().default('available'),
    batchTracking: boolean('batch_tracking').default(false).notNull(), // Added batchTracking
  },
  table => ({
    storeProductIndex: index('idx_inventory_store_product').on(table.storeId, table.productId),
    statusIndex: index('idx_inventory_status').on(table.status),
    quantityIndex: index('idx_inventory_quantity').on(table.totalQuantity),
    // Optional: Add a unique constraint if a product can only appear once per store
    // storeProductUnique: unique("unique_inventory_store_product").on(table.storeId, table.productId),
  })
);

// Zod schemas for inventory
// batchTracking is now part of the inventory table, so createInsertSchema will infer it.
// No need to explicitly define it in the overrides for createInsertSchema.
export const inventoryInsertSchema = createInsertSchema(inventory);

export const inventorySelectSchema = createSelectSchema(inventory);

// For updates, batchTracking will be inferred as optional by .partial() from inventoryInsertSchema.
// No need to explicitly add it via .extend() here if the inferred optional boolean is sufficient.
export const inventoryUpdateSchema = inventoryInsertSchema.partial().omit({
  storeId: true,
  productId: true, // Usually, storeId and productId are not updatable in an inventory record
});

// Type exports for inventory
export type Inventory = z.infer<typeof inventorySelectSchema>;
export type InventoryInsert = z.infer<typeof inventoryInsertSchema>;
export type InventoryUpdate = z.infer<typeof inventoryUpdateSchema>;

// Relations for inventory
export const inventoryRelations = relations(inventory, ({ one, many }) => ({
  store: one(stores, {
    fields: [inventory.storeId],
    references: [stores.id],
  }),
  product: one(products, {
    fields: [inventory.productId],
    references: [products.id],
  }),
  batches: many(inventoryBatches),
}));

// Inventory Batches table
export const inventoryBatches = pgTable(
  'inventory_batches',
  {
    id: serial('id').primaryKey(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
    inventoryId: integer('inventory_id')
      .references(() => inventory.id)
      .notNull(),
    batchNumber: text('batch_number').notNull(), // Unique constraint handled below
    quantity: integer('quantity').notNull(),
    costPerUnit: decimal('cost_per_unit', { precision: 10, scale: 2 }).notNull(),
    expiryDate: timestamp('expiry_date', { mode: 'date' }), // Nullable by default
    receivedDate: timestamp('received_date', { mode: 'date' }).notNull(),
    supplierId: integer('supplier_id').references(() => suppliers.id), // Nullable by default
  },
  table => ({
    batchNumberInventoryIndex: unique('unique_idx_inventory_batches_inventory_batch').on(
      table.inventoryId,
      table.batchNumber
    ),
    expiryDateIndex: index('idx_inventory_batches_expiry_date').on(table.expiryDate),
  })
);

// Zod schemas for inventory batches
export const inventoryBatchInsertSchema = createInsertSchema(inventoryBatches);

export const inventoryBatchSelectSchema = createSelectSchema(inventoryBatches);

export const inventoryBatchUpdateSchema = inventoryBatchInsertSchema.partial().omit({
  inventoryId: true, // Typically, inventoryId is not updatable in a batch record directly
  // batchNumber: true, // Batch number might also be non-updatable once set
});

// Type exports for inventory batches
export type InventoryBatch = z.infer<typeof inventoryBatchSelectSchema>;
export type InventoryBatchInsert = z.infer<typeof inventoryBatchInsertSchema>;

// Relations for inventory batches
export const inventoryBatchesRelations = relations(inventoryBatches, ({ one }) => ({
  inventory: one(inventory, {
    fields: [inventoryBatches.inventoryId],
    references: [inventory.id],
  }),
  supplier: one(suppliers, {
    fields: [inventoryBatches.supplierId],
    references: [suppliers.id],
  }),
}));
