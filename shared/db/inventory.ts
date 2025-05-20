import { pgTable, text, boolean, integer, decimal, timestamp, unique, primaryKey, foreignKey, index } from "drizzle-orm/pg-core";
import { z } from "zod";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { baseTable, timestampsSchema, softDeleteSchema, commonValidators } from "./base";
import { stores, products } from "./products";

// Inventory status
export const inventoryStatus = z.enum(["available", "low_stock", "out_of_stock", "reserved"]);

// Inventory table
export const inventory = pgTable("inventory", {
  ...baseTable,
  storeId: integer("store_id").references(() => stores.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  totalQuantity: integer("total_quantity").notNull().default(0),
  minimumLevel: integer("minimum_level").notNull().default(0),
  status: text("status").notNull().default("available"),
  storeProductIndex: index("idx_inventory_store_product").on((inventory) => [inventory.storeId, inventory.productId]),
  statusIndex: index("idx_inventory_status").on((inventory) => inventory.status),
  quantityIndex: index("idx_inventory_quantity").on((inventory) => inventory.totalQuantity),
});

// Validation schemas
export const inventoryInsertSchema = createInsertSchema(inventory, {
  storeId: (schema) => schema.number().int().positive(),
  productId: (schema) => schema.number().int().positive(),
  totalQuantity: commonValidators.quantity,
  minimumLevel: commonValidators.quantity,
  status: (schema) => schema.enum(inventoryStatus.enum),
});

export const inventoryUpdateSchema = inventoryInsertSchema.omit({
  storeId: true,
  productId: true,
});

// Type exports
export type Inventory = z.infer<typeof createSelectSchema(inventory)>;
export type InventoryInsert = z.infer<typeof inventoryInsertSchema>;
export type InventoryUpdate = z.infer<typeof inventoryUpdateSchema>;

// Relations
export const inventoryRelations = relations(inventory, ({ one, many }) => ({
  store: one(stores, {
    fields: [inventory.storeId],
    references: [stores.id],
  }),
  product: one(products, {
    fields: [inventory.productId],
    references: [products.id],
  }),
  batches: many(() => inventoryBatches),
}));

// Inventory batches
export const inventoryBatches = pgTable("inventory_batches", {
  ...baseTable,
  inventoryId: integer("inventory_id").references(() => inventory.id).notNull(),
  batchNumber: text("batch_number").notNull().unique(),
  quantity: integer("quantity").notNull(),
  costPerUnit: decimal("cost_per_unit", { precision: 10, scale: 2 }).notNull(),
  expiryDate: timestamp("expiry_date"),
  receivedDate: timestamp("received_date").notNull(),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  batchNumberIndex: index("idx_inventory_batches_batch_number").on((table) => table.batchNumber),
  expiryDateIndex: index("idx_inventory_batches_expiry_date").on((table) => table.expiryDate),
});

export const inventoryBatchInsertSchema = createInsertSchema(inventoryBatches, {
  inventoryId: (schema) => schema.number().int().positive(),
  batchNumber: (schema) => schema.string().min(1, "Batch number is required"),
  quantity: commonValidators.quantity,
  costPerUnit: commonValidators.amount,
  expiryDate: (schema) => schema.date().optional(),
  receivedDate: (schema) => schema.date(),
  supplierId: (schema) => schema.number().int().positive().optional(),
});

export type InventoryBatch = z.infer<typeof createSelectSchema(inventoryBatches)>;
export type InventoryBatchInsert = z.infer<typeof inventoryBatchInsertSchema>;

// Relations for inventory batches
export const inventoryBatchesRelations = relations(inventoryBatches, ({ one }) => ({
  inventory: one(inventory, {
    fields: [inventoryBatches.inventoryId],
    references: [inventory.id],
  }),
  supplier: one(() => suppliers, {
    fields: [inventoryBatches.supplierId],
    references: [suppliers.id],
  }),
}));
