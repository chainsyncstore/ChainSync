import { pgTable, text, integer, timestamp, boolean, json, decimal, uuid, serial } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Users table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  password: text('password').notNull(),
  role: text('role', { enum: ['admin', 'manager', 'cashier'] }).default('cashier'),
  storeId: integer('store_id'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Stores table
export const stores = pgTable('stores', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  location: text('location').notNull(),
  managerId: integer('manager_id'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Products table
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  barcode: text('barcode').unique(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  cost: decimal('cost', { precision: 10, scale: 2 }),
  category: text('category'),
  brand: text('brand'),
  unit: text('unit').default('pcs'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Inventory table
export const inventory = pgTable('inventory', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull(),
  storeId: integer('store_id').notNull(),
  quantity: integer('quantity').default(0),
  minStock: integer('min_stock').default(0),
  maxStock: integer('max_stock'),
  lastRestocked: timestamp('last_restocked'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Transactions table
export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  storeId: integer('store_id').notNull(),
  userId: integer('user_id').notNull(),
  customerId: integer('customer_id'),
  total: decimal('total', { precision: 10, scale: 2 }).notNull(),
  subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull(),
  tax: decimal('tax', { precision: 10, scale: 2 }).default('0'),
  discount: decimal('discount', { precision: 10, scale: 2 }).default('0'),
  paymentMethod: text('payment_method', { enum: ['cash', 'card', 'mobile'] }).notNull(),
  status: text('status', { enum: ['pending', 'completed', 'cancelled'] }).default('pending'),
  items: json('items'), // Store transaction items as JSON
  createdAt: timestamp('created_at').defaultNow(),
});

// Subscriptions table
export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  planId: text('plan_id').notNull(),
  status: text('status', { enum: ['active', 'cancelled', 'expired'] }).default('active'),
  currentPeriodStart: timestamp('current_period_start'),
  currentPeriodEnd: timestamp('current_period_end'),
  endDate: timestamp('end_date'),
  metadata: json('metadata'),
  paymentMethod: text('payment_method'),
  amount: decimal('amount', { precision: 10, scale: 2 }),
  currency: text('currency').default('USD'),
  referralCode: text('referral_code'),
  autoRenew: boolean('auto_renew').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStoreSchema = createInsertSchema(stores).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInventorySchema = createInsertSchema(inventory).omit({
  id: true,
  updatedAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Type exports
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertStore = z.infer<typeof insertStoreSchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type InsertInventory = z.infer<typeof insertInventorySchema>;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type SubscriptionInsert = InsertSubscription; // Alias for compatibility

export type SelectUser = typeof users.$inferSelect;
export type SelectStore = typeof stores.$inferSelect;
export type SelectProduct = typeof products.$inferSelect;
export type SelectInventory = typeof inventory.$inferSelect;
export type SelectTransaction = typeof transactions.$inferSelect;
export type SelectSubscription = typeof subscriptions.$inferSelect;