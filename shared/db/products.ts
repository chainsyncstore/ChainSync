import { pgTable, text, boolean, integer, decimal, timestamp, unique, primaryKey, foreignKey, index } from "drizzle-orm/pg-core";
import { z } from "zod";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { baseTable, timestampsSchema, softDeleteSchema, commonValidators } from "./base";
import { stores } from "./stores";
import { transactions, transactionItems } from "./transactions";
import { inventory } from "./inventory";

// Product status
export const productStatus = z.enum(["active", "inactive", "out_of_stock", "discontinued"]);

// Category table (if not already defined in stores.ts)
export const categories = pgTable("categories", {
  ...baseTable,
  name: text("name").notNull(),
  description: text("description"),
  parentCategoryId: integer("parent_category_id").references(() => categories.id),
  nameIndex: index("idx_categories_name").on((categories) => categories.name),
});

export const categoryInsertSchema = createInsertSchema(categories, {
  name: commonValidators.name,
  description: commonValidators.name.optional(),
  parentCategoryId: (schema) => schema.number().int().positive().optional(),
});

export type Category = z.infer<typeof createSelectSchema(categories)>;
export type CategoryInsert = z.infer<typeof categoryInsertSchema>;

// Relations for categories
export const categoriesRelations = relations(categories, ({ many, one }) => ({
  parentCategory: one(categories, {
    fields: [categories.parentCategoryId],
    references: [categories.id],
  }),
  subCategories: many(categories, {
    fields: [categories.id],
    references: [categories.parentCategoryId],
  }),
  products: many(() => products),
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
  status: text("status").notNull().default("active"),
  skuIndex: index("idx_products_sku").on((products) => products.sku),
  barcodeIndex: index("idx_products_barcode").on((products) => products.barcode),
  statusIndex: index("idx_products_status").on((products) => products.status),
  categoryIndex: index("idx_products_category").on((products) => products.categoryId),
});

// Validation schemas
export const productInsertSchema = createInsertSchema(products, {
  name: commonValidators.name,
  sku: (schema) => schema.string().min(1, "SKU is required"),
  description: commonValidators.name.optional(),
  barcode: (schema) => schema.string().optional(),
  categoryId: (schema) => schema.number().int().positive(),
  price: commonValidators.amount,
  cost: commonValidators.amount,
  isPerishable: (schema) => schema.boolean(),
  imageUrl: (schema) => schema.string().url().optional(),
  bonusPoints: (schema) => schema.number().min(0, "Bonus points must be non-negative"),
  status: (schema) => schema.enum(productStatus.enum),
});

export const productUpdateSchema = productInsertSchema.omit({
  name: true,
  sku: true,
  categoryId: true,
});

// Type exports
export type Product = z.infer<typeof createSelectSchema(products)>;
export type ProductInsert = z.infer<typeof productInsertSchema>;
export type ProductUpdate = z.infer<typeof productUpdateSchema>;

// Relations
export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  inventory: many(() => inventory),
  transactionItems: many(() => transactionItems),
}));
