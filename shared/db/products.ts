import { pgTable, text, boolean, integer, decimal, index } from "drizzle-orm/pg-core";
import { z } from "zod";
import { createInsertSchema } from "drizzle-zod";
import { baseTable } from "./base";
import { relations } from "drizzle-orm";

// Product status enum
export const ProductStatus = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  OUT_OF_STOCK: "out_of_stock",
  DISCONTINUED: "discontinued"
} as const;

export type ProductStatus = typeof ProductStatus[keyof typeof ProductStatus];

export const productStatusSchema = z.enum([
  ProductStatus.ACTIVE,
  ProductStatus.INACTIVE,
  ProductStatus.OUT_OF_STOCK,
  ProductStatus.DISCONTINUED
]);

// Category table
export const categories = pgTable("categories", {
  ...baseTable,
  name: text("name").notNull(),
  description: text("description"),
  parentCategoryId: integer("parent_category_id").references(() => categories.id),
}, (table) => ({
  nameIndex: index("idx_categories_name").on(table.name)
}));

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export const categoryInsertSchema = createInsertSchema(categories)
  .extend({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional().nullable(), // Nullable in DB, optional for insert
    parentCategoryId: z.number().int().positive().optional().nullable(), // Nullable FK, optional for insert
  });

// Relations for categories
export const categoriesRelations = relations(categories, ({ many, one }) => ({
  parentCategory: one(categories, {
    fields: [categories.parentCategoryId],
    references: [categories.id],
  }),
  subCategories: many(categories, {
    relationName: "categoryHierarchy"
  }),
  products: many(products),
}));

// Product table
export const products = pgTable("products", {
  ...baseTable,
  name: text("name").notNull(),
  sku: text("sku").notNull().unique(),
  description: text("description"),
  barcode: text("barcode"),
  categoryId: integer("category_id").references(() => categories.id).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  cost: decimal("cost", { precision: 10, scale: 2 }).default("0"),
  isPerishable: boolean("is_perishable").notNull().default(false),
  imageUrl: text("image_url"),
  bonusPoints: decimal("bonus_points", { precision: 10, scale: 2 }).default("0"),
  status: text("status", { enum: ["active", "inactive", "out_of_stock", "discontinued"] })
    .notNull()
    .default(ProductStatus.ACTIVE),
}, (table) => ({
  skuIndex: index("idx_products_sku").on(table.sku),
  barcodeIndex: index("idx_products_barcode").on(table.barcode),
  statusIndex: index("idx_products_status").on(table.status),
  categoryIndex: index("idx_products_category").on(table.categoryId),
}));

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

// Validation schemas
export const productInsertSchema = createInsertSchema(products)
  .extend({
    name: z.string().min(1, "Name is required"),
    sku: z.string().min(1, "SKU is required"),
    description: z.string().optional().nullable(), // Nullable in DB
    barcode: z.string().optional().nullable(), // Nullable in DB
    categoryId: z.number().int().positive(), // NOT NULL FK in DB
    price: z.coerce.number().min(0, "Price must be non-negative"), // Drizzle-zod infers decimal as string
    cost: z.coerce.number().min(0, "Cost must be non-negative").optional(), // DB default, optional for insert
    isPerishable: z.boolean().optional(), // DB default, optional for insert
    imageUrl: z.string().url().optional().nullable(), // Nullable in DB
    bonusPoints: z.coerce.number().min(0, "Bonus points must be non-negative").optional(), // DB default
    status: productStatusSchema.optional(), // DB default
  });

export const productUpdateSchema = productInsertSchema.partial().extend({
  // Retain SKU and categoryId as optional for updates, but validated if present
  sku: productInsertSchema.shape.sku.optional(),
  categoryId: productInsertSchema.shape.categoryId.optional(),
});

// Relations
export const productsRelations = relations(products, ({ one }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  // Uncomment and fix these when the related tables are available
  // inventory: many(inventory),
  // transactionItems: many(transactionItems),
}));
