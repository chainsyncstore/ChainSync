"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inventoryBatchesRelations = exports.inventoryBatchSelectSchema = exports.inventoryBatchInsertSchema = exports.inventoryBatches = exports.inventoryRelations = exports.inventoryUpdateSchema = exports.inventorySelectSchema = exports.inventoryInsertSchema = exports.inventory = exports.inventoryStatus = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
const zod_1 = require("zod");
const drizzle_zod_1 = require("drizzle-zod");
const base_1 = require("./base");
const products_1 = require("./products");
const stores_1 = require("./stores");
const suppliers_1 = require("./suppliers");
// Inventory status enum
exports.inventoryStatus = zod_1.z.enum(["available", "low_stock", "out_of_stock", "reserved"]);
// Inventory table
exports.inventory = (0, pg_core_1.pgTable)("inventory", {
    ...base_1.baseTable,
    storeId: (0, pg_core_1.integer)("store_id").references(() => stores_1.stores.id).notNull(),
    productId: (0, pg_core_1.integer)("product_id").references(() => products_1.products.id).notNull(),
    totalQuantity: (0, pg_core_1.integer)("total_quantity").notNull().default(0),
    availableQuantity: (0, pg_core_1.integer)("available_quantity").notNull().default(0),
    minimumLevel: (0, pg_core_1.integer)("minimum_level").notNull().default(0),
    batchTracking: (0, pg_core_1.boolean)("batch_tracking").notNull().default(false),
    status: (0, pg_core_1.text)("status", { enum: exports.inventoryStatus.options }).notNull().default("available"),
}, (table) => ({
    storeProductIndex: (0, pg_core_1.index)("idx_inventory_store_product").on(table.storeId, table.productId),
    statusIndex: (0, pg_core_1.index)("idx_inventory_status").on(table.status),
    quantityIndex: (0, pg_core_1.index)("idx_inventory_quantity").on(table.totalQuantity),
    // Optional: Add a unique constraint if a product can only appear once per store
    // storeProductUnique: unique("unique_inventory_store_product").on(table.storeId, table.productId),
}));
// Zod schemas for inventory
exports.inventoryInsertSchema = (0, drizzle_zod_1.createInsertSchema)(exports.inventory, {
    storeId: zod_1.z.number().int().positive("Store ID must be a positive integer"),
    productId: zod_1.z.number().int().positive("Product ID must be a positive integer"),
    totalQuantity: zod_1.z.number().int().min(0, "Total quantity cannot be negative"),
    availableQuantity: zod_1.z.number().int().min(0, "Available quantity cannot be negative"),
    minimumLevel: zod_1.z.number().int().min(0, "Minimum level cannot be negative"),
    batchTracking: zod_1.z.boolean().default(false),
});
exports.inventorySelectSchema = (0, drizzle_zod_1.createSelectSchema)(exports.inventory);
exports.inventoryUpdateSchema = exports.inventoryInsertSchema.partial().omit({
    storeId: true,
    productId: true, // Usually, storeId and productId are not updatable in an inventory record
});
// Relations for inventory
exports.inventoryRelations = (0, drizzle_orm_1.relations)(exports.inventory, ({ one, many }) => ({
    store: one(stores_1.stores, {
        fields: [exports.inventory.storeId],
        references: [stores_1.stores.id],
    }),
    product: one(products_1.products, {
        fields: [exports.inventory.productId],
        references: [products_1.products.id],
    }),
    batches: many(exports.inventoryBatches),
}));
// Inventory Batches table
exports.inventoryBatches = (0, pg_core_1.pgTable)("inventory_batches", {
    ...base_1.baseTable,
    inventoryId: (0, pg_core_1.integer)("inventory_id").references(() => exports.inventory.id).notNull(),
    batchNumber: (0, pg_core_1.text)("batch_number").notNull(), // Unique constraint handled below
    quantity: (0, pg_core_1.integer)("quantity").notNull(),
    costPerUnit: (0, pg_core_1.decimal)("cost_per_unit", { precision: 10, scale: 2 }).notNull(),
    expiryDate: (0, pg_core_1.timestamp)("expiry_date", { mode: 'date' }), // Nullable by default
    receivedDate: (0, pg_core_1.timestamp)("received_date", { mode: 'date' }).notNull(),
    supplierId: (0, pg_core_1.integer)("supplier_id").references(() => suppliers_1.suppliers.id), // Nullable by default
}, (table) => ({
    batchNumberInventoryIndex: (0, pg_core_1.unique)("unique_idx_inventory_batches_inventory_batch").on(table.inventoryId, table.batchNumber),
    expiryDateIndex: (0, pg_core_1.index)("idx_inventory_batches_expiry_date").on(table.expiryDate),
}));
// Zod schemas for inventory batches
exports.inventoryBatchInsertSchema = (0, drizzle_zod_1.createInsertSchema)(exports.inventoryBatches, {
    // Refine specific fields upfront
    inventoryId: (_s) => zod_1.z.number().int().positive("Inventory ID must be a positive integer"),
    batchNumber: (_s) => zod_1.z.string().min(1, "Batch number is required"),
    receivedDate: (_s) => zod_1.z.date(), // Assuming receivedDate is NOT NULL in DB and needs to be a ZodDate
    // Let drizzle-zod infer quantity, costPerUnit, expiryDate, supplierId initially
}).extend({
    // Now, explicitly define/refine these schemas for insert purposes
    quantity: zod_1.z.number().int().min(0, "Quantity cannot be negative"),
    costPerUnit: zod_1.z.number().positive("Cost per unit must be positive"),
    expiryDate: zod_1.z.date().optional().nullable(), // For nullable DB date, make it optional & nullable for insert
    supplierId: zod_1.z.number().int().positive("Supplier ID must be a positive integer").optional().nullable(), // For nullable FK
});
exports.inventoryBatchSelectSchema = (0, drizzle_zod_1.createSelectSchema)(exports.inventoryBatches);
// Relations for inventory batches
exports.inventoryBatchesRelations = (0, drizzle_orm_1.relations)(exports.inventoryBatches, ({ one }) => ({
    inventory: one(exports.inventory, {
        fields: [exports.inventoryBatches.inventoryId],
        references: [exports.inventory.id],
    }),
    supplier: one(suppliers_1.suppliers, {
        fields: [exports.inventoryBatches.supplierId],
        references: [suppliers_1.suppliers.id],
    }),
}));
