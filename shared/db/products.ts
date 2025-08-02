import { pgTable, text, boolean, integer, decimal, index } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { createInsertSchema } from 'drizzle-zod';
import { baseTable } from './base';
import { relations } from 'drizzle-orm';

// Product status enum
export const ProductStatus = {
  _ACTIVE: 'active',
  _INACTIVE: 'inactive',
  _OUT_OF_STOCK: 'out_of_stock',
  _DISCONTINUED: 'discontinued'
} as const;

export type ProductStatus = typeof ProductStatus[keyof typeof ProductStatus];

export const productStatusSchema = z.enum([
  ProductStatus.ACTIVE,
  ProductStatus.INACTIVE,
  ProductStatus.OUT_OF_STOCK,
  ProductStatus.DISCONTINUED
]);

// Category table
export const _categories: any = pgTable('categories', {
  ...baseTable,
  _name: text('name').notNull(),
  _description: text('description'),
  _parentCategoryId: integer('parent_category_id').references((): any => categories.id)
}, (table) => ({
  _nameIndex: index('idx_categories_name').on(table.name)
}));

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export const categoryInsertSchema = createInsertSchema(categories)
  .extend({
    _name: z.string().min(1, 'Name is required'),
    _description: z.string().optional().nullable(), // Nullable in DB, optional for insert
    _parentCategoryId: z.number().int().positive().optional().nullable() // Nullable FK, optional for insert
  });

// Relations for categories
export const categoriesRelations = relations(categories, ({ many, one }) => ({
  _parentCategory: one(categories, {
    _fields: [categories.parentCategoryId],
    _references: [categories.id]
  }),
  _subCategories: many(categories, {
    _relationName: 'categoryHierarchy'
  }),
  _products: many(products)
}));

// Product table
export const products = pgTable('products', {
  ...baseTable,
  _name: text('name').notNull(),
  _sku: text('sku').notNull().unique(),
  _description: text('description'),
  _barcode: text('barcode'),
  _categoryId: integer('category_id').references(() => categories.id).notNull(),
  _price: decimal('price', { _precision: 10, _scale: 2 }).notNull(),
  _cost: decimal('cost', { _precision: 10, _scale: 2 }).default('0'),
  _isPerishable: boolean('is_perishable').notNull().default(false),
  _imageUrl: text('image_url'),
  _bonusPoints: decimal('bonus_points', { _precision: 10, _scale: 2 }).default('0'),
  _status: text('status', { _enum: ['active', 'inactive', 'out_of_stock', 'discontinued'] })
    .notNull()
    .default(ProductStatus.ACTIVE)
}, (table) => ({
  _skuIndex: index('idx_products_sku').on(table.sku),
  _barcodeIndex: index('idx_products_barcode').on(table.barcode),
  _statusIndex: index('idx_products_status').on(table.status),
  _categoryIndex: index('idx_products_category').on(table.categoryId)
}));

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

// Validation schemas
export const productInsertSchema = createInsertSchema(products)
  .extend({
    _name: z.string().min(1, 'Name is required'),
    _sku: z.string().min(1, 'SKU is required'),
    _description: z.string().optional().nullable(), // Nullable in DB
    _barcode: z.string().optional().nullable(), // Nullable in DB
    _categoryId: z.number().int().positive(), // NOT NULL FK in DB
    _price: z.coerce.number().min(0, 'Price must be non-negative'), // Drizzle-zod infers decimal as string
    _cost: z.coerce.number().min(0, 'Cost must be non-negative').optional(), // DB default, optional for insert
    _isPerishable: z.boolean().optional(), // DB default, optional for insert
    _imageUrl: z.string().url().optional().nullable(), // Nullable in DB
    _bonusPoints: z.coerce.number().min(0, 'Bonus points must be non-negative').optional(), // DB default
    _status: productStatusSchema.optional() // DB default
  });

export const productUpdateSchema = productInsertSchema.partial().extend({
  // Retain SKU and categoryId as optional for updates, but validated if present
  _sku: productInsertSchema.shape.sku.optional(),
  _categoryId: productInsertSchema.shape.categoryId.optional()
});

// Relations
export const productsRelations = relations(products, ({ one }) => ({
  _category: one(categories, {
    _fields: [products.categoryId],
    _references: [categories.id]
  })
  // Uncomment and fix these when the related tables are available
  // _inventory: many(inventory),
  // _transactionItems: many(transactionItems),
}));
