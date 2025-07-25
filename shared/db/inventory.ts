import { pgTable, text, integer, decimal, timestamp, index, unique, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { z } from "zod";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { baseTable, commonValidators } from "./base";
import { products } from "./products";
import { stores } from "./stores";
import { suppliers } from "./suppliers";

// Inventory status enum
export const inventoryStatus = z.enum(["available", "low_stock", "out_of_stock", "reserved"]);
export type InventoryStatus = z.infer<typeof inventoryStatus>;

// Inventory table
export const inventory = pgTable("inventory", {
  ...baseTable,
  storeId: integer("store_id").references(() => stores.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  totalQuantity: integer("total_quantity").notNull().default(0),
  availableQuantity: integer("available_quantity").notNull().default(0),
  minimumLevel: integer("minimum_level").notNull().default(0),
  batchTracking: boolean("batch_tracking").notNull().default(false),
  status: text("status", { enum: inventoryStatus.options }).notNull().default("available"),
}, (table) => ({
  storeProductIndex: index("idx_inventory_store_product").on(table.storeId, table.productId),
  statusIndex: index("idx_inventory_status").on(table.status),
  quantityIndex: index("idx_inventory_quantity").on(table.totalQuantity),
  // Optional: Add a unique constraint if a product can only appear once per store
  // storeProductUnique: unique("unique_inventory_store_product").on(table.storeId, table.productId),
}));

// Zod schemas for inventory
export const inventoryInsertSchema = createInsertSchema(inventory, {
  storeId: z.number().int().positive("Store ID must be a positive integer"),
  productId: z.number().int().positive("Product ID must be a positive integer"),
  totalQuantity: z.number().int().min(0, "Total quantity cannot be negative"),
  availableQuantity: z.number().int().min(0, "Available quantity cannot be negative"),
  minimumLevel: z.number().int().min(0, "Minimum level cannot be negative"),
  batchTracking: z.boolean().default(false),
});

export const inventorySelectSchema = createSelectSchema(inventory);

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
export const inventoryBatches = pgTable("inventory_batches", {
  ...baseTable,
  inventoryId: integer("inventory_id").references(() => inventory.id).notNull(),
  batchNumber: text("batch_number").notNull(), // Unique constraint handled below
  quantity: integer("quantity").notNull(),
  costPerUnit: decimal("cost_per_unit", { precision: 10, scale: 2 }).notNull(),
  expiryDate: timestamp("expiry_date", { mode: 'date' }), // Nullable by default
  receivedDate: timestamp("received_date", { mode: 'date' }).notNull(),
  supplierId: integer("supplier_id").references(() => suppliers.id), // Nullable by default
}, (table) => ({
  batchNumberInventoryIndex: unique("unique_idx_inventory_batches_inventory_batch").on(table.inventoryId, table.batchNumber),
  expiryDateIndex: index("idx_inventory_batches_expiry_date").on(table.expiryDate),
}));

// Zod schemas for inventory batches
export const inventoryBatchInsertSchema = createInsertSchema(inventoryBatches, {
  // Refine specific fields upfront
  inventoryId: (_s) => z.number().int().positive("Inventory ID must be a positive integer"),
  batchNumber: (_s) => z.string().min(1, "Batch number is required"),
  receivedDate: (_s) => z.date(), // Assuming receivedDate is NOT NULL in DB and needs to be a ZodDate
  // Let drizzle-zod infer quantity, costPerUnit, expiryDate, supplierId initially
}).extend({
  // Now, explicitly define/refine these schemas for insert purposes
  quantity: z.number().int().min(0, "Quantity cannot be negative"),
  costPerUnit: z.number().positive("Cost per unit must be positive"), 
  expiryDate: z.date().optional().nullable(), // For nullable DB date, make it optional & nullable for insert
  supplierId: z.number().int().positive("Supplier ID must be a positive integer").optional().nullable(), // For nullable FK
});

export const inventoryBatchSelectSchema = createSelectSchema(inventoryBatches);

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
