import { pgTable, text, integer, decimal, timestamp, index, unique, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { z } from 'zod';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { baseTable, commonValidators } from './base';
import { products } from './products';
import { stores } from './stores';
import { suppliers } from './suppliers';

// Inventory status enum
export const inventoryStatus = z.enum(['available', 'low_stock', 'out_of_stock', 'reserved']);
export type InventoryStatus = z.infer<typeof inventoryStatus>;

// Inventory table
export const inventory = pgTable('inventory', {
  ...baseTable,
  _storeId: integer('store_id').references(() => stores.id).notNull(),
  _productId: integer('product_id').references(() => products.id).notNull(),
  _totalQuantity: integer('total_quantity').notNull().default(0),
  _availableQuantity: integer('available_quantity').notNull().default(0),
  _minimumLevel: integer('minimum_level').notNull().default(0),
  _batchTracking: boolean('batch_tracking').notNull().default(false),
  _status: text('status', { _enum: ['available', 'low_stock', 'out_of_stock', 'reserved'] }).notNull().default('available')
}, (table) => ({
  _storeProductIndex: index('idx_inventory_store_product').on(table.storeId, table.productId),
  _statusIndex: index('idx_inventory_status').on(table.status),
  _quantityIndex: index('idx_inventory_quantity').on(table.totalQuantity)
  // _Optional: Add a unique constraint if a product can only appear once per store
  // _storeProductUnique: unique("unique_inventory_store_product").on(table.storeId, table.productId),
}));

// Zod schemas for inventory
export const inventoryInsertSchema = createInsertSchema(inventory, {
  _storeId: z.number().int().positive('Store ID must be a positive integer'),
  _productId: z.number().int().positive('Product ID must be a positive integer'),
  _totalQuantity: z.number().int().min(0, 'Total quantity cannot be negative'),
  _availableQuantity: z.number().int().min(0, 'Available quantity cannot be negative'),
  _minimumLevel: z.number().int().min(0, 'Minimum level cannot be negative'),
  _batchTracking: z.boolean().default(false)
});

export const inventorySelectSchema = createSelectSchema(inventory);

export const inventoryUpdateSchema = inventoryInsertSchema.partial().omit({
  _storeId: true,
  _productId: true // Usually, storeId and productId are not updatable in an inventory record
});

// Type exports for inventory
export type Inventory = z.infer<typeof inventorySelectSchema>;
export type InventoryInsert = z.infer<typeof inventoryInsertSchema>;
export type InventoryUpdate = z.infer<typeof inventoryUpdateSchema>;

// Relations for inventory
export const inventoryRelations = relations(inventory, ({ one, many }) => ({
  _store: one(stores, {
    _fields: [inventory.storeId],
    _references: [stores.id]
  }),
  _product: one(products, {
    _fields: [inventory.productId],
    _references: [products.id]
  }),
  _batches: many(inventoryBatches)
}));

// Inventory Batches table
export const inventoryBatches = pgTable('inventory_batches', {
  ...baseTable,
  _inventoryId: integer('inventory_id').references(() => inventory.id).notNull(),
  _batchNumber: text('batch_number').notNull(), // Unique constraint handled below
  _quantity: integer('quantity').notNull(),
  _costPerUnit: decimal('cost_per_unit', { _precision: 10, _scale: 2 }).notNull(),
  _expiryDate: timestamp('expiry_date', { _mode: 'date' }), // Nullable by default
  _receivedDate: timestamp('received_date', { _mode: 'date' }).notNull(),
  _supplierId: integer('supplier_id').references(() => suppliers.id) // Nullable by default
}, (table) => ({
  _batchNumberInventoryIndex: unique('unique_idx_inventory_batches_inventory_batch').on(table.inventoryId, table.batchNumber),
  _expiryDateIndex: index('idx_inventory_batches_expiry_date').on(table.expiryDate)
}));

// Zod schemas for inventory batches
export const inventoryBatchInsertSchema = createInsertSchema(inventoryBatches, {
  // Refine specific fields upfront
  _inventoryId: (_s) => z.number().int().positive('Inventory ID must be a positive integer'),
  _batchNumber: (_s) => z.string().min(1, 'Batch number is required'),
  _receivedDate: (_s) => z.date() // Assuming receivedDate is NOT NULL in DB and needs to be a ZodDate
  // Let drizzle-zod infer quantity, costPerUnit, expiryDate, supplierId initially
}).extend({
  // Now, explicitly define/refine these schemas for insert purposes
  _quantity: z.number().int().min(0, 'Quantity cannot be negative'),
  _costPerUnit: z.number().positive('Cost per unit must be positive'),
  _expiryDate: z.date().optional().nullable(), // For nullable DB date, make it optional & nullable for insert
  _supplierId: z.number().int().positive('Supplier ID must be a positive integer').optional().nullable() // For nullable FK
});

export const inventoryBatchSelectSchema = createSelectSchema(inventoryBatches);

// Type exports for inventory batches
export type InventoryBatch = z.infer<typeof inventoryBatchSelectSchema>;
export type InventoryBatchInsert = z.infer<typeof inventoryBatchInsertSchema>;

// Relations for inventory batches
export const inventoryBatchesRelations = relations(inventoryBatches, ({ one }) => ({
  _inventory: one(inventory, {
    _fields: [inventoryBatches.inventoryId],
    _references: [inventory.id]
  }),
  _supplier: one(suppliers, {
    _fields: [inventoryBatches.supplierId],
    _references: [suppliers.id]
  })
}));
