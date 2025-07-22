import { 
  pgTable, 
  serial, 
  integer, 
  text, 
  boolean, 
  timestamp, 
  jsonb, 
  unique, 
  primaryKey, 
  foreignKey, 
  index, 
  decimal 
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { z } from "zod";
import { 
  paymentStatus, 
  paymentAnalytics, 
  paymentRefunds, 
  paymentWebhooks, 
  paymentStatusRelations, 
  paymentRefundsRelations, 
  paymentWebhooksRelations 
} from "./payment-schema";
import { transactions, transactionItems, transactionPayments } from "./db/transactions";
import { customers } from "./db/customers";

// Users & Authentication
export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    username: text('username').notNull().unique(),
    password: text('password').notNull(),
    fullName: text('full_name').notNull(),
    email: text('email').notNull(),
    role: text('role').notNull().default('cashier'),
    storeId: integer('store_id').references(() => stores.id),
    isActive: boolean('is_active').notNull().default(true),
    lastLogin: timestamp('last_login'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  table => ({
    usernameIndex: index('idx_users_username').on(table.username),
    emailIndex: index('idx_users_email').on(table.email),
    roleIndex: index('idx_users_role').on(table.role),
  })
);

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  used: boolean('used').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  store: one(stores, {
    fields: [users.storeId],
    references: [stores.id],
  }),
  passwordResetTokens: many(passwordResetTokens),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, {
    fields: [passwordResetTokens.userId],
    references: [users.id],
  }),
}));

// Stores
export const stores = pgTable(
  'stores',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    address: text('address').notNull(),
    city: text('city').notNull(),
    state: text('state').notNull(),
    country: text('country').notNull(),
    phone: text('phone').notNull(),
    email: text('email').notNull(),
    timezone: text('timezone').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  table => ({
    nameIndex: index('idx_stores_name').on(table.name),
    emailIndex: index('idx_stores_email').on(table.email),
  })
);

export const storesRelations = relations(stores, ({ many }) => ({
  users: many(users),
  inventory: many(inventory),
}));

// Product Categories
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

// Alias for backward compatibility
export const productCategories = categories;

// Brands
export const brands = pgTable('brands', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});



// Products
// ---- Webhook Tables ----

export const webhooks = pgTable('webhooks', {
  id: serial('id').primaryKey(),
  url: text('url').notNull(),
  storeId: integer('store_id').references(() => stores.id).notNull(),
  secret: text('secret').notNull(),
  events: jsonb('events').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const webhookEvents = pgTable('webhook_events', {
  id: serial('id').primaryKey(),
  eventType: text('event_type').notNull(),
  data: jsonb('data').notNull(),
  storeId: integer('store_id').references(() => stores.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const webhookDeliveries = pgTable('webhook_deliveries', {
  id: serial('id').primaryKey(),
  webhookId: integer('webhook_id').references(() => webhooks.id).notNull(),
  eventId: integer('event_id').references(() => webhookEvents.id).notNull(),
  attempt: integer('attempt').notNull(),
  status: text('status').notNull().default('pending'),
  responseCode: integer('response_code'),
  responseBody: text('response_body'),
  errorMessage: text('error_message'),
  deliveredAt: timestamp('delivered_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ one }) => ({
  webhook: one(webhooks, {
    fields: [webhookDeliveries.webhookId],
    references: [webhooks.id],
  }),
  event: one(webhookEvents, {
    fields: [webhookDeliveries.eventId],
    references: [webhookEvents.id],
  }),
}));

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  sku: text('sku').notNull().unique(),
  description: text('description'),
  barcode: text('barcode'),
  categoryId: integer('category_id')
    .references(() => categories.id)
    .notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  storeId: integer('store_id').references(() => stores.id).notNull(),
  brandId: integer('brand_id').references(() => brands.id),
  isActive: boolean('is_active').default(true).notNull(),
  attributes: jsonb('attributes'),
  cost: decimal('cost', { precision: 10, scale: 2 }).default('0'),
  isPerishable: boolean('is_perishable').notNull().default(false),
  imageUrl: text('image_url'),
  bonusPoints: decimal('bonus_points', { precision: 10, scale: 2 }).default('0'), // For loyalty program bonus points
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  brand: one(brands, {
    fields: [products.brandId],
    references: [brands.id],
  }),
  inventory: many(inventory),
}));

// Brands relations now that products is defined
export const brandsRelations = relations(brands, ({ many }) => ({
  products: many(products),
}));

// Inventory (master record for each product in a store)
export const inventory = pgTable(
  'inventory',
  {
    id: serial('id').primaryKey(),
    storeId: integer('store_id')
      .references(() => stores.id)
      .notNull(),
    productId: integer('product_id')
      .references(() => products.id)
      .notNull(),
    totalQuantity: integer('total_quantity').notNull().default(0), // Sum of all batch quantities
    availableQuantity: integer('available_quantity').notNull().default(0),
    minimumLevel: integer('minimum_level').notNull().default(10),
    batchTracking: boolean('batch_tracking').notNull().default(false),
    lastStockUpdate: timestamp('last_stock_update').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  table => {
    return {
      storeProductUnique: unique().on(table.storeId, table.productId),
    };
  }
);

// Inventory Batches - tracking different batches with their expiry dates
// Logs for inventory changes
export const inventoryLogs = pgTable('inventory_logs', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .references(() => products.id)
    .notNull(),
  previousQuantity: integer('previous_quantity').notNull(),
  newQuantity: integer('new_quantity').notNull(),
  quantity: integer('quantity').notNull(),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const inventoryBatches = pgTable('inventory_batches', {
  id: serial('id').primaryKey(),
  inventoryId: integer('inventory_id')
    .references(() => inventory.id)
    .notNull(),
  batchNumber: text('batch_number').notNull(),
  quantity: integer('quantity').notNull().default(0),
  expiryDate: timestamp('expiry_date'),
  manufacturingDate: timestamp('manufacturing_date'),
  costPerUnit: decimal('cost_per_unit', { precision: 10, scale: 2 }),
  receivedDate: timestamp('received_date').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

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

export const inventoryBatchesRelations = relations(inventoryBatches, ({ one, many }) => ({
  inventory: one(inventory, {
    fields: [inventoryBatches.inventoryId],
    references: [inventory.id],
  }),
  auditLogs: many(batchAuditLogs),
}));

// Batch audit logs to track changes
export const batchAuditLogs = pgTable('batch_audit_logs', {
  id: serial('id').primaryKey(),
  batchId: integer('batch_id').references(() => inventoryBatches.id, { onDelete: 'set null' }),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  action: text('action').notNull(),
  details: jsonb('details').notNull(),
  quantityBefore: integer('quantity_before'),
  quantityAfter: integer('quantity_after'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const batchAuditLogsRelations = relations(batchAuditLogs, ({ one }) => ({
  batch: one(inventoryBatches, {
    fields: [batchAuditLogs.batchId],
    references: [inventoryBatches.id],
  }),
  user: one(users, {
    fields: [batchAuditLogs.userId],
    references: [users.id],
  }),
}));

// Suppliers
export const suppliers = pgTable('suppliers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  contactName: text('contact_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  address: text('address').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  purchaseOrders: many(purchaseOrders),
}));

// Purchase Orders
export const purchaseOrders = pgTable('purchase_orders', {
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  supplierId: integer('supplier_id')
    .references(() => suppliers.id)
    .notNull(),
  status: text('status').notNull().default('pending'), // pending, approved, received, cancelled
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  store: one(stores, {
    fields: [purchaseOrders.storeId],
    references: [stores.id],
  }),
  supplier: one(suppliers, {
    fields: [purchaseOrders.supplierId],
    references: [suppliers.id],
  }),
  creator: one(users, {
    fields: [purchaseOrders.createdBy],
    references: [users.id],
  }),
  items: many(purchaseOrderItems),
}));

// Purchase Order Items
export const purchaseOrderItems = pgTable('purchase_order_items', {
  id: serial('id').primaryKey(),
  purchaseOrderId: integer('purchase_order_id')
    .references(() => purchaseOrders.id)
    .notNull(),
  productId: integer('product_id')
    .references(() => products.id)
    .notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const purchaseOrderItemsRelations = relations(purchaseOrderItems, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [purchaseOrderItems.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
  product: one(products, {
    fields: [purchaseOrderItems.productId],
    references: [products.id],
  }),
}));

// Cashier Sessions
export const cashierSessions = pgTable('cashier_sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  startTime: timestamp('start_time').defaultNow().notNull(),
  endTime: timestamp('end_time'),
  transactionCount: integer('transaction_count').default(0),
  totalSales: decimal('total_sales', { precision: 10, scale: 2 }).default('0.00'),
  notes: text('notes'),
  status: text('status').notNull().default('active'), // active, closed
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const cashierSessionsRelations = relations(cashierSessions, ({ one }) => ({
  user: one(users, {
    fields: [cashierSessions.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [cashierSessions.storeId],
    references: [stores.id],
  }),
}));

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

// AI Assistant Conversations
export const aiConversations = pgTable('ai_conversations', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  messages: jsonb('messages').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const aiConversationsRelations = relations(aiConversations, ({ one }) => ({
  user: one(users, {
    fields: [aiConversations.userId],
    references: [users.id],
  }),
}));

export const aiConversationInsertSchema = createInsertSchema(aiConversations, {
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
        timestamp: z.string().optional(),
      })
    )
    .default([]),
});
export const aiConversationSelectSchema = createSelectSchema(aiConversations, {
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
      timestamp: z.string().optional(),
    })
  ),
});

export type AiConversation = typeof aiConversations.$inferSelect;
export type AiConversationInsert = z.infer<typeof aiConversationInsertSchema>;

// Validation Schemas
// User schemas are defined later in the file

export const storeInsertSchema = createInsertSchema(stores, {
  name: z.string().min(2, "Store name must be at least 2 characters"),
  phone: z.string().optional(),
});

export const categoryInsertSchema = createInsertSchema(categories, {
  name: z.string().min(2, "Category name must be at least 2 characters"),
});

export const productInsertSchema = createInsertSchema(products, {
  name: z.string().min(2, "Product name must be at least 2 characters"),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, "Price must be a valid decimal with up to 2 decimal places"),
  sku: z.string().min(3, "SKU must be at least 3 characters"),
});

export const inventoryInsertSchema = createInsertSchema(inventory, {
  totalQuantity: z.number().int().nonnegative({ message: "Total quantity must be a non-negative integer" }),
  minimumLevel: z.number().int().nonnegative({ message: "Minimum level must be a non-negative integer" }),
});

export const inventoryBatchInsertSchema = createInsertSchema(inventoryBatches, {
  quantity: z.number().int().nonnegative({ message: "Quantity must be a non-negative integer" }),
  costPerUnit: z.number().positive({ message: "Cost per unit must be a positive number" }).optional(),
  batchNumber: z
    .string()
    .min(1, { message: 'Batch number cannot be empty if provided' })
    .optional(),
  expiryDate: z.coerce.date().optional(),
});

// Schema for user operations
export const userSchema = createSelectSchema(users);
export const userInsertSchema = createInsertSchema(users, {
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email('Please provide a valid email address'),
  role: z.enum(["admin", "manager", "cashier", "affiliate"]).default("cashier"),
});

// Auth schemas
export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

export const authResponseSchema = z.object({
  authenticated: z.boolean(),
  user: userSchema.omit({ password: true }).optional(),
  message: z.string().optional(),
});

// Type exports
export type User = typeof users.$inferSelect;
export type UserInsert = z.infer<typeof userInsertSchema>;

export const passwordResetTokenInsertSchema = createInsertSchema(passwordResetTokens, {
  token: z.string().min(1, 'Token is required'),
  userId: z.number().positive('User ID must be positive'),
});

export const passwordResetTokenSchema = createSelectSchema(passwordResetTokens);
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type PasswordResetTokenInsert = z.infer<typeof passwordResetTokenInsertSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;

export type Store = typeof stores.$inferSelect;
export type StoreInsert = z.infer<typeof storeInsertSchema>;

export type Category = typeof categories.$inferSelect;
export type CategoryInsert = z.infer<typeof categoryInsertSchema>;

export type Product = typeof products.$inferSelect;
export type ProductInsert = z.infer<typeof productInsertSchema>;

export type Inventory = typeof inventory.$inferSelect;
export type InventoryInsert = z.infer<typeof inventoryInsertSchema>;

export type InventoryBatch = typeof inventoryBatches.$inferSelect;
export type InventoryBatchInsert = z.infer<typeof inventoryBatchInsertSchema>;

export type Supplier = typeof suppliers.$inferSelect;
export type SupplierInsert = typeof suppliers.$inferInsert;

export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type PurchaseOrderInsert = typeof purchaseOrders.$inferInsert;

export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type PurchaseOrderItemInsert = typeof purchaseOrderItems.$inferInsert;

export const cashierSessionInsertSchema = createInsertSchema(cashierSessions, {
  userId: z.number().positive('User ID must be positive'),
  storeId: z.number().positive('Store ID must be positive'),
  status: z.enum(["active", "closed"]).default("active"),
  notes: z.string().optional()
});

export const cashierSessionSchema = createSelectSchema(cashierSessions);
export type CashierSession = typeof cashierSessions.$inferSelect;
export type CashierSessionInsert = z.infer<typeof cashierSessionInsertSchema>;

// Payment Methods
export const paymentMethods = pgTable('payment_methods', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const paymentMethodsRelations = relations(paymentMethods, ({ many }) => ({}));

// Returns and Refunds System
// Note: customers table is imported from ./db/customers.ts

// Return reason lookup table
export const returnReasons = pgTable('return_reasons', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Product returns table - Note: This table is actually called 'refunds' in the database
export const returns = pgTable('refunds', {
  id: serial('id').primaryKey(),
  refundId: text('refund_id').notNull().unique(), // a readable ID (e.g., RET-12345)
  transactionId: integer('transaction_id')
    .references(() => transactions.id)
    .notNull(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  processedById: integer('processed_by_id')
    .references(() => users.id)
    .notNull(),
  reason: text('reason'),
  subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull(),
  tax: decimal('tax', { precision: 10, scale: 2 }).notNull(),
  total: decimal('total', { precision: 10, scale: 2 }).notNull(),
  refundMethod: text('refund_method').notNull(), // cash, credit_card, store_credit
  status: text('status').notNull().default('pending'), // pending, approved, rejected
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const returnsRelations = relations(returns, ({ one, many }) => ({
  store: one(stores, {
    fields: [returns.storeId],
    references: [stores.id],
  }),
  processor: one(users, {
    fields: [returns.processedById],
    references: [users.id],
  }),
  transaction: one(transactions, {
    fields: [returns.transactionId],
    references: [transactions.id],
  }),
  items: many(returnItems),
}));

// Return items table (actually refund_items in the database)
export const returnItems = pgTable('refund_items', {
  id: serial('id').primaryKey(),
  refundId: integer('refund_id')
    .references(() => returns.id)
    .notNull(),
  transactionItemId: integer('transaction_item_id').references(() => transactionItems.id),
  productId: integer('product_id')
    .references(() => products.id)
    .notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull(),
  returnReasonId: integer('return_reason_id'),
  isRestocked: boolean('is_restocked').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const returnItemsRelations = relations(returnItems, ({ one }) => ({
  refund: one(returns, {
    fields: [returnItems.refundId],
    references: [returns.id],
  }),
  product: one(products, {
    fields: [returnItems.productId],
    references: [products.id],
  }),
  transactionItem: one(transactionItems, {
    fields: [returnItems.transactionItemId],
    references: [transactionItems.id],
  }),
}));

// Validation schemas for returns
export const customerInsertSchema = createInsertSchema(customers, {
  fullName: z.string().min(2, 'Customer name must be at least 2 characters'),
});

export const returnReasonInsertSchema = createInsertSchema(returnReasons, {
  name: z.string().min(2, 'Reason name must be at least 2 characters'),
});

export const returnInsertSchema = createInsertSchema(returns, {
  refundId: z.string().min(5, 'Refund ID must be at least 5 characters'),
  total: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Total amount must be a positive number',
  }),
});

export const returnItemInsertSchema = createInsertSchema(returnItems, {
  quantity: z.number().refine(val => val > 0, {
    message: 'Quantity must be greater than 0',
  }),
});

// Type exports for returns
// Note: Customer types are exported at the end of the file

export type ReturnReason = typeof returnReasons.$inferSelect;
export type ReturnReasonInsert = z.infer<typeof returnReasonInsertSchema>;

export type Return = typeof returns.$inferSelect;
export type ReturnInsert = z.infer<typeof returnInsertSchema>;

export type ReturnItem = typeof returnItems.$inferSelect;
export type ReturnItemInsert = z.infer<typeof returnItemInsertSchema>;

// Affiliate Program Schema
export const affiliates = pgTable('affiliates', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  code: text('code').notNull().unique(),
  totalReferrals: integer('total_referrals').default(0).notNull(),
  totalEarnings: decimal('total_earnings', { precision: 10, scale: 2 }).default('0').notNull(),
  pendingEarnings: decimal('pending_earnings', { precision: 10, scale: 2 }).default('0').notNull(),
  bankName: text('bank_name'),
  accountNumber: text('account_number'),
  accountName: text('account_name'),
  bankCode: text('bank_code'),
  paymentMethod: text('payment_method').default('paystack'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const affiliatesRelations = relations(affiliates, ({ one }) => ({
  user: one(users, { fields: [affiliates.userId], references: [users.id] }),
}));

export const referrals = pgTable('referrals', {
  id: serial('id').primaryKey(),
  affiliateId: integer('affiliate_id')
    .references(() => affiliates.id)
    .notNull(),
  referredUserId: integer('referred_user_id')
    .references(() => users.id)
    .notNull(),
  status: text('status').default('pending').notNull(), // pending, active, completed, cancelled
  discountApplied: boolean('discount_applied').default(false).notNull(),
  commissionPaid: boolean('commission_paid').default(false).notNull(),
  signupDate: timestamp('signup_date').defaultNow().notNull(),
  activationDate: timestamp('activation_date'),
  expiryDate: timestamp('expiry_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const referralsRelations = relations(referrals, ({ one }) => ({
  affiliate: one(affiliates, { fields: [referrals.affiliateId], references: [affiliates.id] }),
  referredUser: one(users, { fields: [referrals.referredUserId], references: [users.id] }),
}));

export const referralPayments = pgTable('referral_payments', {
  id: serial('id').primaryKey(),
  affiliateId: integer('affiliate_id')
    .references(() => affiliates.id)
    .notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').default('NGN').notNull(),
  status: text('status').default('pending').notNull(), // pending, completed, failed
  paymentMethod: text('payment_method').default('paystack').notNull(),
  transactionReference: text('transaction_reference'),
  paymentDate: timestamp('payment_date'),
  metadata: text('metadata'), // JSON string with additional data
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const referralPaymentsRelations = relations(referralPayments, ({ one }) => ({
  affiliate: one(affiliates, {
    fields: [referralPayments.affiliateId],
    references: [affiliates.id],
  }),
}));

export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  plan: text('plan').notNull(), // basic, pro, enterprise
  status: text('status').default('active').notNull(), // active, cancelled, expired
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').default('NGN').notNull(),
  referralCode: text('referral_code'),
  discountApplied: boolean('discount_applied').default(false).notNull(),
  discountAmount: decimal('discount_amount', { precision: 10, scale: 2 }).default('0').notNull(),
  startDate: timestamp('start_date').defaultNow().notNull(),
  endDate: timestamp('end_date').notNull(),
  autoRenew: boolean('auto_renew').default(true).notNull(),
  paymentProvider: text('payment_provider').default('paystack').notNull(),
  paymentReference: text('payment_reference'),
  metadata: text('metadata'), // JSON string with additional data
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, { fields: [subscriptions.userId], references: [users.id] }),
}));

// --- Loyalty Program Schema ---
export const loyaltyPrograms = pgTable('loyalty_programs', {
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;

// --- Inventory Items Definition ---
// This definition is added to resolve the 'inventoryItems' not found error.
// It is based on the usage in server/services/inventory/enhanced-service.ts and shared/schema-validation.ts

export const inventoryItems = pgTable('inventory_items', {
  id: serial('id').primaryKey(),
  inventoryId: integer('inventory_id')
    .references(() => inventory.id)
    .notNull(),
  productId: integer('product_id')
    .references(() => products.id)
    .notNull(),
  sku: text('sku').notNull().unique(),
  quantity: integer('quantity').notNull().default(0),
  reorderLevel: integer('reorder_level').notNull().default(0),
  reorderQuantity: integer('reorder_quantity').notNull().default(0),
  receivedDate: timestamp('received_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  metadata: jsonb('metadata'),
});

// duplicate definition removed
  inventory: one(inventory, {
    fields: [inventoryItems.inventoryId],
    references: [inventory.id],
  }),
  product: one(products, {
    fields: [inventoryItems.productId],
    references: [products.id],
  }),
}));

// Create insert schema for inventory items
export const inventoryItemInsertSchema = createInsertSchema(inventoryItems, {
  sku: z.string().min(3, "SKU must be at least 3 characters"),
  quantity: z.number().int().min(0, "Quantity cannot be negative"),
  reorderLevel: z.number().int().min(0, "Reorder level cannot be negative").optional(),
  reorderQuantity: z.number().int().min(0, "Reorder quantity cannot be negative").optional(),
});

// Export type for inventory items
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InventoryItemInsert = z.infer<typeof inventoryItemInsertSchema>;

// --- Inventory Items Definition ---
// This definition is added to resolve the 'inventoryItems' not found error.
// It is based on the usage in server/services/inventory/enhanced-service.ts and shared/schema-validation.ts

export const inventoryItems = pgTable('inventory_items', {
  id: serial('id').primaryKey(),
  inventoryId: integer('inventory_id')
    .references(() => inventory.id)
    .notNull(),
  productId: integer('product_id')
    .references(() => products.id)
    .notNull(),
  sku: text('sku').notNull().unique(),
  quantity: integer('quantity').notNull().default(0),
  reorderLevel: integer('reorder_level').notNull().default(0),
  reorderQuantity: integer('reorder_quantity').notNull().default(0),
  receivedDate: timestamp('received_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  metadata: jsonb('metadata'),
});

// duplicate definition removed
  inventory: one(inventory, {
    fields: [inventoryItems.inventoryId],
    references: [inventory.id],
  }),
  product: one(products, {
    fields: [inventoryItems.productId],
    references: [products.id],
  }),
}));

// Create insert schema for inventory items
export const inventoryItemInsertSchema = createInsertSchema(inventoryItems, {
  sku: z.string().min(3, "SKU must be at least 3 characters"),
  quantity: z.number().int().min(0, "Quantity cannot be negative"),
  reorderLevel: z.number().int().min(0, "Reorder level cannot be negative").optional(),
  reorderQuantity: z.number().int().min(0, "Reorder quantity cannot be negative").optional(),
});

// Export type for inventory items
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InventoryItemInsert = z.infer<typeof inventoryItemInsertSchema>;

// --- Inventory Items Definition ---
// This definition is added to resolve the 'inventoryItems' not found error.
// It is based on the usage in server/services/inventory/enhanced-service.ts and shared/schema-validation.ts

export const inventoryItems = pgTable('inventory_items', {
  id: serial('id').primaryKey(),
  inventoryId: integer('inventory_id')
    .references(() => inventory.id)
    .notNull(),
  productId: integer('product_id')
    .references(() => products.id)
    .notNull(),
  sku: text('sku').notNull().unique(),
  quantity: integer('quantity').notNull().default(0),
  reorderLevel: integer('reorder_level').notNull().default(0),
  reorderQuantity: integer('reorder_quantity').notNull().default(0),
  receivedDate: timestamp('received_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  metadata: jsonb('metadata'),
});

// duplicate definition removed
  inventory: one(inventory, {
    fields: [inventoryItems.inventoryId],
    references: [inventory.id],
  }),
  product: one(products, {
    fields: [inventoryItems.productId],
    references: [products.id],
  }),
}));

// Create insert schema for inventory items
export const inventoryItemInsertSchema = createInsertSchema(inventoryItems, {
  sku: z.string().min(3, "SKU must be at least 3 characters"),
  quantity: z.number().int().min(0, "Quantity cannot be negative"),
  reorderLevel: z.number().int().min(0, "Reorder level cannot be negative").optional(),
  reorderQuantity: z.number().int().min(0, "Reorder quantity cannot be negative").optional(),
});

// Export type for inventory items
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InventoryItemInsert = z.infer<typeof inventoryItemInsertSchema>;

// --- Inventory Items Definition ---
// This definition is added to resolve the 'inventoryItems' not found error.
// It is based on the usage in server/services/inventory/enhanced-service.ts and shared/schema-validation.ts

export const inventoryItems = pgTable('inventory_items', {
  id: serial('id').primaryKey(),
  inventoryId: integer('inventory_id')
    .references(() => inventory.id)
    .notNull(),
  productId: integer('product_id')
    .references(() => products.id)
    .notNull(),
  sku: text('sku').notNull().unique(),
  quantity: integer('quantity').notNull().default(0),
  reorderLevel: integer('reorder_level').notNull().default(0),
  reorderQuantity: integer('reorder_quantity').notNull().default(0),
  receivedDate: timestamp('received_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  metadata: jsonb('metadata'),
});

// duplicate definition removed
  inventory: one(inventory, {
    fields: [inventoryItems.inventoryId],
    references: [inventory.id],
  }),
  product: one(products, {
    fields: [inventoryItems.productId],
    references: [products.id],
  }),
}));

// Create insert schema for inventory items
export const inventoryItemInsertSchema = createInsertSchema(inventoryItems, {
  sku: z.string().min(3, "SKU must be at least 3 characters"),
  quantity: z.number().int().min(0, "Quantity cannot be negative"),
  reorderLevel: z.number().int().min(0, "Reorder level cannot be negative").optional(),
  reorderQuantity: z.number().int().min(0, "Reorder quantity cannot be negative").optional(),
});

// Export type for inventory items
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InventoryItemInsert = z.infer<typeof inventoryItemInsertSchema>;

// --- Inventory Items Definition ---
// This definition is added to resolve the 'inventoryItems' not found error.
// It is based on the usage in server/services/inventory/enhanced-service.ts and shared/schema-validation.ts

export const inventoryItems = pgTable('inventory_items', {
  id: serial('id').primaryKey(),
  inventoryId: integer('inventory_id')
    .references(() => inventory.id)
    .notNull(),
  productId: integer('product_id')
    .references(() => products.id)
    .notNull(),
  sku: text('sku').notNull().unique(),
  quantity: integer('quantity').notNull().default(0),
  reorderLevel: integer('reorder_level').notNull().default(0),
  reorderQuantity: integer('reorder_quantity').notNull().default(0),
  receivedDate: timestamp('received_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  metadata: jsonb('metadata'),
});

// duplicate definition removed
  inventory: one(inventory, {
    fields: [inventoryItems.inventoryId],
    references: [inventory.id],
  }),
  product: one(products, {
    fields: [inventoryItems.productId],
    references: [products.id],
  }),
}));

// Create insert schema for inventory items
export const inventoryItemInsertSchema = createInsertSchema(inventoryItems, {
  sku: z.string().min(3, "SKU must be at least 3 characters"),
  quantity: z.number().int().min(0, "Quantity cannot be negative"),
  reorderLevel: z.number().int().min(0, "Reorder level cannot be negative").optional(),
  reorderQuantity: z.number().int().min(0, "Reorder quantity cannot be negative").optional(),
});

// Export type for inventory items
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InventoryItemInsert = z.infer<typeof inventoryItemInsertSchema>;

// --- Inventory Items Definition ---
// This definition is added to resolve the 'inventoryItems' not found error.
// It is based on the usage in server/services/inventory/enhanced-service.ts and shared/schema-validation.ts

export const inventoryItems = pgTable('inventory_items', {
  id: serial('id').primaryKey(),
  inventoryId: integer('inventory_id')
    .references(() => inventory.id)
    .notNull(),
  productId: integer('product_id')
    .references(() => products.id)
    .notNull(),
  sku: text('sku').notNull().unique(),
  quantity: integer('quantity').notNull().default(0),
  reorderLevel: integer('reorder_level').notNull().default(0),
  reorderQuantity: integer('reorder_quantity').notNull().default(0),
  receivedDate: timestamp('received_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  metadata: jsonb('metadata'),
});

// duplicate definition removed
  inventory: one(inventory, {
    fields: [inventoryItems.inventoryId],
    references: [inventory.id],
  }),
  product: one(products, {
    fields: [inventoryItems.productId],
    references: [products.id],
  }),
}));

// Create insert schema for inventory items
export const inventoryItemInsertSchema = createInsertSchema(inventoryItems, {
  sku: z.string().min(3, "SKU must be at least 3 characters"),
  quantity: z.number().int().min(0, "Quantity cannot be negative"),
  reorderLevel: z.number().int().min(0, "Reorder level cannot be negative").optional(),
  reorderQuantity: z.number().int().min(0, "Reorder quantity cannot be negative").optional(),
});

// Export type for inventory items
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InventoryItemInsert = z.infer<typeof inventoryItemInsertSchema>;

// --- Inventory Items Definition ---
// This definition is added to resolve the 'inventoryItems' not found error.
// It is based on the usage in server/services/inventory/enhanced-service.ts and shared/schema-validation.ts

export const inventoryItems = pgTable('inventory_items', {
  id: serial('id').primaryKey(),
  inventoryId: integer('inventory_id')
    .references(() => inventory.id)
    .notNull(),
  productId: integer('product_id')
    .references(() => products.id)
    .notNull(),
  sku: text('sku').notNull().unique(),
  quantity: integer('quantity').notNull().default(0),
  reorderLevel: integer('reorder_level').notNull().default(0),
  reorderQuantity: integer('reorder_quantity').notNull().default(0),
  receivedDate: timestamp('received_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  metadata: jsonb('metadata'),
});

// duplicate definition removed
  inventory: one(inventory, {
    fields: [inventoryItems.inventoryId],
    references: [inventory.id],
  }),
  product: one(products, {
    fields: [inventoryItems.productId],
    references: [products.id],
  }),
}));

// Create insert schema for inventory items
export const inventoryItemInsertSchema = createInsertSchema(inventoryItems, {
  sku: z.string().min(3, "SKU must be at least 3 characters"),
  quantity: z.number().int().min(0, "Quantity cannot be negative"),
  reorderLevel: z.number().int().min(0, "Reorder level cannot be negative").optional(),
  reorderQuantity: z.number().int().min(0, "Reorder quantity cannot be negative").optional(),
});

// Export type for inventory items
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InventoryItemInsert = z.infer<typeof inventoryItemInsertSchema>;

// --- Inventory Items Definition ---
// This definition is added to resolve the 'inventoryItems' not found error.
// It is based on the usage in server/services/inventory/enhanced-service.ts and shared/schema-validation.ts

export const inventoryItems = pgTable('inventory_items', {
  id: serial('id').primaryKey(),
  inventoryId: integer('inventory_id')
    .references(() => inventory.id)
    .notNull(),
  productId: integer('product_id')
    .references(() => products.id)
    .notNull(),
  sku: text('sku').notNull().unique(),
  quantity: integer('quantity').notNull().default(0),
  reorderLevel: integer('reorder_level').notNull().default(0),
  reorderQuantity: integer('reorder_quantity').notNull().default(0),
  receivedDate: timestamp('received_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  metadata: jsonb('metadata'),
});

// duplicate definition removed
  inventory: one(inventory, {
    fields: [inventoryItems.inventoryId],
    references: [inventory.id],
  }),
  product: one(products, {
    fields: [inventoryItems.productId],
    references: [products.id],
  }),
}));

// Create insert schema for inventory items
export const inventoryItemInsertSchema = createInsertSchema(inventoryItems, {
  sku: z.string().min(3, "SKU must be at least 3 characters"),
  quantity: z.number().int().min(0, "Quantity cannot be negative"),
  reorderLevel: z.number().int().min(0, "Reorder level cannot be negative").optional(),
  reorderQuantity: z.number().int().min(0, "Reorder quantity cannot be negative").optional(),
});

// Export type for inventory items
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InventoryItemInsert = z.infer<typeof inventoryItemInsertSchema>;

// --- Inventory Items Definition ---
// This definition is added to resolve the 'inventoryItems' not found error.
// It is based on the usage in server/services/inventory/enhanced-service.ts and shared/schema-validation.ts

export const inventoryItems = pgTable('inventory_items', {
  id: serial('id').primaryKey(),
  inventoryId: integer('inventory_id')
    .references(() => inventory.id)
    .notNull(),
  productId: integer('product_id')
    .references(() => products.id)
    .notNull(),
  sku: text('sku').notNull().unique(),
  quantity: integer('quantity').notNull().default(0),
  reorderLevel: integer('reorder_level').notNull().default(0),
  reorderQuantity: integer('reorder_quantity').notNull().default(0),
  receivedDate: timestamp('received_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  metadata: jsonb('metadata'),
});

// duplicate definition removed
  inventory: one(inventory, {
    fields: [inventoryItems.inventoryId],
    references: [inventory.id],
  }),
  product: one(products, {
    fields: [inventoryItems.productId],
    references: [products.id],
  }),
}));

// Create insert schema for inventory items
export const inventoryItemInsertSchema = createInsertSchema(inventoryItems, {
  sku: z.string().min(3, "SKU must be at least 3 characters"),
  quantity: z.number().int().min(0, "Quantity cannot be negative"),
  reorderLevel: z.number().int().min(0, "Reorder level cannot be negative").optional(),
  reorderQuantity: z.number().int().min(0, "Reorder quantity cannot be negative").optional(),
});

// Export type for inventory items
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InventoryItemInsert = z.infer<typeof inventoryItemInsertSchema>;

// --- Inventory Items Definition ---
// This definition is added to resolve the 'inventoryItems' not found error.
// It is based on the usage in server/services/inventory/enhanced-service.ts and shared/schema-validation.ts

export const inventoryItems = pgTable('inventory_items', {
  id: serial('id').primaryKey(),
  inventoryId: integer('inventory_id')
    .references(() => inventory.id)
    .notNull(),
  productId: integer('product_id')
    .references(() => products.id)
    .notNull(),
  sku: text('sku').notNull().unique(),
  quantity: integer('quantity').notNull().default(0),
  reorderLevel: integer('reorder_level').notNull().default(0),
  reorderQuantity: integer('reorder_quantity').notNull().default(0),
  receivedDate: timestamp('received_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  metadata: jsonb('metadata'),
});

// duplicate definition removed
  inventory: one(inventory, {
    fields: [inventoryItems.inventoryId],
    references: [inventory.id],
  }),
  product: one(products, {
    fields: [inventoryItems.productId],
    references: [products.id],
  }),
}));

// Create insert schema for inventory items
export const inventoryItemInsertSchema = createInsertSchema(inventoryItems, {
  sku: z.string().min(3, "SKU must be at least 3 characters"),
  quantity: z.number().int().min(0, "Quantity cannot be negative"),
  reorderLevel: z.number().int().min(0, "Reorder level cannot be negative").optional(),
  reorderQuantity: z.number().int().min(0, "Reorder quantity cannot be negative").optional(),
});

// Export type for inventory items
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InventoryItemInsert = z.infer<typeof inventoryItemInsertSchema>;

// --- Inventory Items Definition ---
// This definition is added to resolve the 'inventoryItems' not found error.
// It is based on the usage in server/services/inventory/enhanced-service.ts and shared/schema-validation.ts

export const inventoryItems = pgTable('inventory_items', {
  id: serial('id').primaryKey(),
  inventoryId: integer('inventory_id')
    .references(() => inventory.id)
    .notNull(),
  productId: integer('product_id')
    .references(() => products.id)
    .notNull(),
  sku: text('sku').notNull().unique(),
  quantity: integer('quantity').notNull().default(0),
  reorderLevel: integer('reorder_level').notNull().default(0),
  reorderQuantity: integer('reorder_quantity').notNull().default(0),
  receivedDate: timestamp('received_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  metadata: jsonb('metadata'),
});

// duplicate definition removed
  inventory: one(inventory, {
    fields: [inventoryItems.inventoryId],
    references: [inventory.id],
  }),
  product: one(products, {
    fields: [inventoryItems.productId],
    references: [products.id],
  }),
}));

// Create insert schema for inventory items
export const inventoryItemInsertSchema = createInsertSchema(inventoryItems, {
  sku: z.string().min(3, "SKU must be at least 3 characters"),
  quantity: z.number().int().min(0, "Quantity cannot be negative"),
  reorderLevel: z.number().int().min(0, "Reorder level cannot be negative").optional(),
  reorderQuantity: z.number().int().min(0, "Reorder quantity cannot be negative").optional(),
});

// Export type for inventory items
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InventoryItemInsert = z.infer<typeof inventoryItemInsertSchema>;

// --- End of Inventory Items Definition ---
// --- Loyalty Program Schema ---
export const loyaltyPrograms = pgTable('loyalty_programs', {
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', '
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', '
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_expiryMonths').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;

// --- Inventory Items Definition ---
// This definition is added to resolve the 'inventoryItems' not found error.
// It is based on the usage in server/services/inventory/enhanced-service.ts and shared/schema-validation.ts

export const inventoryItems = pgTable('inventory_items', {
  id: serial('id').primaryKey(),
  inventoryId: integer('inventory_id')
    .references(() => inventory.id)
    .notNull(),
  productId: integer('product_id')
    .references(() => products.id)
    .notNull(),
  sku: text('sku').notNull().unique(),
  quantity: integer('quantity').notNull().default(0),
  reorderLevel: integer('reorder_level').notNull().default(0),
  reorderQuantity: integer('reorder_quantity').notNull().default(0),
  receivedDate: timestamp('received_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  metadata: jsonb('metadata'),
});

// duplicate definition removed
  inventory: one(inventory, {
    fields: [inventoryItems.inventoryId],
    references: [inventory.id],
  }),
  product: one(products, {
    fields: [inventoryItems.productId],
    references: [products.id],
  }),
}));

// Create insert schema for inventory items
export const inventoryItemInsertSchema = createInsertSchema(inventoryItems, {
  sku: z.string().min(3, "SKU must be at least 3 characters"),
  quantity: z.number().int().min(0, "Quantity cannot be negative"),
  reorderLevel: z.number().int().min(0, "Reorder level cannot be negative").optional(),
  reorderQuantity: z.number().int().min(0, "Reorder quantity cannot be negative").optional(),
});

// Export type for inventory items
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InventoryItemInsert = z.infer<typeof inventoryItemInsertSchema>;

// --- End of Inventory Items Definition ---
// --- Loyalty Program Schema ---
export const loyaltyPrograms = pgTable('loyalty_programs', {
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;

// --- Inventory Items Definition ---
// This definition is added to resolve the 'inventoryItems' not found error.
// It is based on the usage in server/services/inventory/enhanced-service.ts and shared/schema-validation.ts

export const inventoryItems = pgTable('inventory_items', {
  id: serial('id').primaryKey(),
  inventoryId: integer('inventory_id')
    .references(() => inventory.id)
    .notNull(),
  productId: integer('product_id')
    .references(() => products.id)
    .notNull(),
  sku: text('sku').notNull().unique(),
  quantity: integer('quantity').notNull().default(0),
  reorderLevel: integer('reorder_level').notNull().default(0),
  reorderQuantity: integer('reorder_quantity').notNull().default(0),
  receivedDate: timestamp('received_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  metadata: jsonb('metadata'),
});

// duplicate definition removed
  inventory: one(inventory, {
    fields: [inventoryItems.inventoryId],
    references: [inventory.id],
  }),
  product: one(products, {
    fields: [inventoryItems.productId],
    references: [products.id],
  }),
}));

// Create insert schema for inventory items
export const inventoryItemInsertSchema = createInsertSchema(inventoryItems, {
  sku: z.string().min(3, "SKU must be at least 3 characters"),
  quantity: z.number().int().min(0, "Quantity cannot be negative"),
  reorderLevel: z.number().int().min(0, "Reorder level cannot be negative").optional(),
  reorderQuantity: z.number().int().min(0, "Reorder quantity cannot be negative").optional(),
});

// Export type for inventory items
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InventoryItemInsert = z.infer<typeof inventoryItemInsertSchema>;

// --- End of Inventory Items Definition ---
// --- Loyalty Program Schema ---
export const loyaltyPrograms = pgTable('loyalty_programs', {
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;

// --- Inventory Items Definition ---
// This definition is added to resolve the 'inventoryItems' not found error.
// It is based on the usage in server/services/inventory/enhanced-service.ts and shared/schema-validation.ts

export const inventoryItems = pgTable('inventory_items', {
  id: serial('id').primaryKey(),
  inventoryId: integer('inventory_id')
    .references(() => inventory.id)
    .notNull(),
  productId: integer('product_id')
    .references(() => products.id)
    .notNull(),
  sku: text('sku').notNull().unique(),
  quantity: integer('quantity').notNull().default(0),
  reorderLevel: integer('reorder_level').notNull().default(0),
  reorderQuantity: integer('reorder_quantity').notNull().default(0),
  receivedDate: timestamp('received_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  metadata: jsonb('metadata'),
});

// duplicate definition removed
  inventory: one(inventory, {
    fields: [inventoryItems.inventoryId],
    references: [inventory.id],
  }),
  product: one(products, {
    fields: [inventoryItems.productId],
    references: [products.id],
  }),
}));

// Create insert schema for inventory items
export const inventoryItemInsertSchema = createInsertSchema(inventoryItems, {
  sku: z.string().min(3, "SKU must be at least 3 characters"),
  quantity: z.number().int().min(0, "Quantity cannot be negative"),
  reorderLevel: z.number().int().min(0, "Reorder level cannot be negative").optional(),
  reorderQuantity: z.number().int().min(0, "Reorder quantity cannot be negative").optional(),
});

// Export type for inventory items
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InventoryItemInsert = z.infer<typeof inventoryItemInsertSchema>;

// --- End of Inventory Items Definition ---
// --- Loyalty Program Schema ---
export const loyaltyPrograms = pgTable('loyalty_programs', {
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;

// Type for AI conversation messages
export interface DialogflowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id').references(() => stores.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'alert', 'info', 'warning', 'success'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  readAt: timestamp('read_at'),
  link: text('link'), // Optional link to navigate when clicked
  metadata: jsonb('metadata'), // Additional data related to the notification
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [notifications.storeId],
    references: [stores.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.string().refine(val => ['info', 'warning', 'error', 'success'].includes(val), {
    message: 'Type must be one of: info, warning, error, success',
  }),
});

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = z.infer<typeof notificationInsertSchema>;

// Transaction-related exports
export { transactions, transactionItems, transactionPayments } from "./db/transactions";
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = typeof transactionItems.$inferInsert;
export type TransactionPayment = typeof transactionPayments.$inferSelect;
export type TransactionPaymentInsert = typeof transactionPayments.$inferInsert;

// Customer-related exports
export { customers } from "./db/customers";
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

// Alias for returns table (database table is named 'refunds')
export const refunds = returns;

// --- Inventory Items Definition ---
// This definition is added to resolve the 'inventoryItems' not found error.
// It is based on the usage in server/services/inventory/enhanced-service.ts and shared/schema-validation.ts

export const inventoryItems = pgTable('inventory_items', {
  id: serial('id').primaryKey(),
  inventoryId: integer('inventory_id')
    .references(() => inventory.id)
    .notNull(),
  productId: integer('product_id')
    .references(() => products.id)
    .notNull(),
  sku: text('sku').notNull().unique(),
  quantity: integer('quantity').notNull().default(0),
  reorderLevel: integer('reorder_level').notNull().default(0),
  reorderQuantity: integer('reorder_quantity').notNull().default(0),
  receivedDate: timestamp('received_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  metadata: jsonb('metadata'),
});

// duplicate definition removed
  inventory: one(inventory, {
    fields: [inventoryItems.inventoryId],
    references: [inventory.id],
  }),
  product: one(products, {
    fields: [inventoryItems.productId],
    references: [products.id],
  }),
}));

// Create insert schema for inventory items
export const inventoryItemInsertSchema = createInsertSchema(inventoryItems, {
  sku: z.string().min(3, "SKU must be at least 3 characters"),
  quantity: z.number().int().min(0, "Quantity cannot be negative"),
  reorderLevel: z.number().int().min(0, "Reorder level cannot be negative").optional(),
  reorderQuantity: z.number().int().min(0, "Reorder quantity cannot be negative").optional(),
});

// Export type for inventory items
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InventoryItemInsert = z.infer<typeof inventoryItemInsertSchema>;

// --- End of Inventory Items Definition ---
// --- Loyalty Program Schema ---
export const loyaltyPrograms = pgTable('loyalty_programs', {
  id: serial('id').primaryKey(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "ChainSync Rewards"
  pointsPerAmount: decimal('points_per_amount', { precision: 10, scale: 2 }).notNull(), // e.g., 1 point per 100 currency units
  active: boolean('active').default(true).notNull(),
  expiryMonths: integer('expiry_months').default(12), // Number of months before points expire
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyProgramsRelations = relations(loyaltyPrograms, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyPrograms.storeId],
    references: [stores.id],
  }),
  members: many(loyaltyMembers),
  tiers: many(loyaltyTiers),
  rewards: many(loyaltyRewards),
}));

export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(),
  points: decimal('points', { precision: 10, scale: 2 }).default('0').notNull(), // Unique identifier for the member
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0').notNull(),
  totalPointsEarned: decimal('total_points_earned', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  totalPointsRedeemed: decimal('total_points_redeemed', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  tierId: integer('tier_id').references(() => loyaltyTiers.id),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyMembersRelations = relations(loyaltyMembers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [loyaltyMembers.customerId],
    references: [customers.id],
  }),
  tier: one(loyaltyTiers, {
    fields: [loyaltyMembers.tierId],
    references: [loyaltyTiers.id],
  }),
  transactions: many(loyaltyTransactions),
}));

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(), // e.g., "Silver", "Gold", "Platinum"
  requiredPoints: decimal('required_points', { precision: 10, scale: 2 }).notNull(),
  pointMultiplier: decimal('point_multiplier', { precision: 5, scale: 2 }).default('1.0').notNull(), // Earn rate multiplier
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyTiersRelations = relations(loyaltyTiers, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyTiers.programId],
    references: [loyaltyPrograms.id],
  }),
  members: many(loyaltyMembers),
}));

export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountType: text('discount_type'), // "percentage", "fixed", "free_product"
  productId: integer('product_id').references(() => products.id), // For free product rewards
  active: boolean('active').default(true).notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

export const loyaltyRewardsRelations = relations(loyaltyRewards, ({ one, many }) => ({
  program: one(loyaltyPrograms, {
    fields: [loyaltyRewards.programId],
    references: [loyaltyPrograms.id],
  }),
  product: one(products, {
    fields: [loyaltyRewards.productId],
    references: [products.id],
  }),
  redemptions: many(loyaltyTransactions),
}));

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(),
  transactionType: text('transaction_type').notNull(), // "earn", "redeem", "expire", "adjust"
  pointsEarned: decimal('points_earned', { precision: 10, scale: 2 }),
  pointsRedeemed: decimal('points_redeemed', { precision: 10, scale: 2 }),
  pointsBalance: decimal('points_balance', { precision: 10, scale: 2 }),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  source: text('source'),
  description: text('description'),
  createdBy: integer('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  member: one(loyaltyMembers, {
    fields: [loyaltyTransactions.memberId],
    references: [loyaltyMembers.id],
  }),
  transaction: one(transactions, {
    fields: [loyaltyTransactions.transactionId],
    references: [transactions.id],
  }),
  reward: one(loyaltyRewards, {
    fields: [loyaltyTransactions.rewardId],
    references: [loyaltyRewards.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

// Create validation schemas for loyalty
export const loyaltyProgramInsertSchema = createInsertSchema(loyaltyPrograms, {
  name: z.string().min(2, 'Program name must be at least 2 characters'),
  pointsPerAmount: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points per amount must be a positive number',
  }),
});

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers, {
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

export const loyaltyTierInsertSchema = createInsertSchema(loyaltyTiers, {
  name: z.string().min(2, 'Tier name must be at least 2 characters'),
  requiredPoints: z.string().refine(val => parseFloat(val) >= 0, {
    message: 'Required points must be a positive number',
  }),
});

export const loyaltyRewardInsertSchema = createInsertSchema(loyaltyRewards, {
  name: z.string().min(2, 'Reward name must be at least 2 characters'),
  pointsCost: z.string().refine(val => parseFloat(val) > 0, {
    message: 'Points cost must be a positive number',
  }),
});

export const loyaltyTransactionInsertSchema = createInsertSchema(loyaltyTransactions, {
  type: z.string().refine(val => ['earn', 'redeem', 'expire', 'adjust'].includes(val), {
    message: 'Type must be one of: earn, redeem, expire, adjust',
  }),
  points: z.string().refine(val => parseFloat(val) !== 0, {
    message: 'Points value cannot be zero for a transaction',
  }),
});

// Export types for loyalty
export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyProgramInsert = z.infer<typeof loyaltyProgramInsertSchema>;

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type LoyaltyTierInsert = z.infer<typeof loyaltyTierInsertSchema>;

export type LoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type LoyaltyRewardInsert = z.infer<typeof loyaltyRewardInsertSchema>;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltyTransactionInsert = z.infer<typeof loyaltyTransactionInsertSchema>;
