"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productsRelations = exports.productUpdateSchema = exports.productInsertSchema = exports.products = exports.categoriesRelations = exports.categoryInsertSchema = exports.categories = exports.productStatusSchema = exports.ProductStatus = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const zod_1 = require("zod");
const drizzle_zod_1 = require("drizzle-zod");
const base_1 = require("./base");
const drizzle_orm_1 = require("drizzle-orm");
// Product status enum
exports.ProductStatus = {
    ACTIVE: "active",
    INACTIVE: "inactive",
    OUT_OF_STOCK: "out_of_stock",
    DISCONTINUED: "discontinued"
};
exports.productStatusSchema = zod_1.z.enum([
    exports.ProductStatus.ACTIVE,
    exports.ProductStatus.INACTIVE,
    exports.ProductStatus.OUT_OF_STOCK,
    exports.ProductStatus.DISCONTINUED
]);
// Category table
exports.categories = (0, pg_core_1.pgTable)("categories", {
    ...base_1.baseTable,
    name: (0, pg_core_1.text)("name").notNull(),
    description: (0, pg_core_1.text)("description"),
    parentCategoryId: (0, pg_core_1.integer)("parent_category_id").references(() => exports.categories.id),
}, (table) => ({
    nameIndex: (0, pg_core_1.index)("idx_categories_name").on(table.name)
}));
exports.categoryInsertSchema = (0, drizzle_zod_1.createInsertSchema)(exports.categories)
    .extend({
    name: zod_1.z.string().min(1, "Name is required"),
    description: zod_1.z.string().optional().nullable(), // Nullable in DB, optional for insert
    parentCategoryId: zod_1.z.number().int().positive().optional().nullable(), // Nullable FK, optional for insert
});
// Relations for categories
exports.categoriesRelations = (0, drizzle_orm_1.relations)(exports.categories, ({ many, one }) => ({
    parentCategory: one(exports.categories, {
        fields: [exports.categories.parentCategoryId],
        references: [exports.categories.id],
    }),
    subCategories: many(exports.categories, {
        relationName: "categoryHierarchy"
    }),
    products: many(exports.products),
}));
// Product table
exports.products = (0, pg_core_1.pgTable)("products", {
    ...base_1.baseTable,
    name: (0, pg_core_1.text)("name").notNull(),
    sku: (0, pg_core_1.text)("sku").notNull().unique(),
    description: (0, pg_core_1.text)("description"),
    barcode: (0, pg_core_1.text)("barcode"),
    categoryId: (0, pg_core_1.integer)("category_id").references(() => exports.categories.id).notNull(),
    price: (0, pg_core_1.decimal)("price", { precision: 10, scale: 2 }).notNull(),
    cost: (0, pg_core_1.decimal)("cost", { precision: 10, scale: 2 }).default("0"),
    isPerishable: (0, pg_core_1.boolean)("is_perishable").notNull().default(false),
    imageUrl: (0, pg_core_1.text)("image_url"),
    bonusPoints: (0, pg_core_1.decimal)("bonus_points", { precision: 10, scale: 2 }).default("0"),
    status: (0, pg_core_1.text)("status", { enum: ["active", "inactive", "out_of_stock", "discontinued"] })
        .notNull()
        .default(exports.ProductStatus.ACTIVE),
}, (table) => ({
    skuIndex: (0, pg_core_1.index)("idx_products_sku").on(table.sku),
    barcodeIndex: (0, pg_core_1.index)("idx_products_barcode").on(table.barcode),
    statusIndex: (0, pg_core_1.index)("idx_products_status").on(table.status),
    categoryIndex: (0, pg_core_1.index)("idx_products_category").on(table.categoryId),
}));
// Validation schemas
exports.productInsertSchema = (0, drizzle_zod_1.createInsertSchema)(exports.products)
    .extend({
    name: zod_1.z.string().min(1, "Name is required"),
    sku: zod_1.z.string().min(1, "SKU is required"),
    description: zod_1.z.string().optional().nullable(), // Nullable in DB
    barcode: zod_1.z.string().optional().nullable(), // Nullable in DB
    categoryId: zod_1.z.number().int().positive(), // NOT NULL FK in DB
    price: zod_1.z.coerce.number().min(0, "Price must be non-negative"), // Drizzle-zod infers decimal as string
    cost: zod_1.z.coerce.number().min(0, "Cost must be non-negative").optional(), // DB default, optional for insert
    isPerishable: zod_1.z.boolean().optional(), // DB default, optional for insert
    imageUrl: zod_1.z.string().url().optional().nullable(), // Nullable in DB
    bonusPoints: zod_1.z.coerce.number().min(0, "Bonus points must be non-negative").optional(), // DB default
    status: exports.productStatusSchema.optional(), // DB default
});
exports.productUpdateSchema = exports.productInsertSchema.partial().extend({
    // Retain SKU and categoryId as optional for updates, but validated if present
    sku: exports.productInsertSchema.shape.sku.optional(),
    categoryId: exports.productInsertSchema.shape.categoryId.optional(),
});
// Relations
exports.productsRelations = (0, drizzle_orm_1.relations)(exports.products, ({ one }) => ({
    category: one(exports.categories, {
        fields: [exports.products.categoryId],
        references: [exports.categories.id],
    }),
    // Uncomment and fix these when the related tables are available
    // inventory: many(inventory),
    // transactionItems: many(transactionItems),
}));
