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

// Products
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
  inventoryItems: many(inventory),
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
  inventoryId: integer('inventory_id')
    .references(() => inventory.id)
    .notNull(),
  message: text('message').notNull(),
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

export const storeInsertSchema = createInsertSchema(stores);
// export const storeInsertSchema = createInsertSchema(stores, {
//   name(schema) {
//     return schema.name.min(2, "Store name must be at least 2 characters");
//   },
//   phone(schema) {
//     return schema.phone.optional();
//   }
// });

export const categoryInsertSchema = createInsertSchema(categories);
// export const categoryInsertSchema = createInsertSchema(categories, {
//   name: z.string().min(2, "Category name must be at least 2 characters"),
// });

export const productInsertSchema = createInsertSchema(products);

export const inventoryInsertSchema = createInsertSchema(inventory);
// export const inventoryInsertSchema = createInsertSchema(inventory, {
//   totalQuantity: (schema) => schema.totalQuantity.refine(val => Number.isInteger(val) && val >= 0, { message: "Total quantity must be a non-negative integer" }),
//   minimumLevel: (schema) => schema.minimumLevel.refine(val => Number.isInteger(val) && val >= 0, { message: "Minimum level must be a non-negative integer" }),
// });

export const inventoryBatchInsertSchema = createInsertSchema(inventoryBatches, {
  // quantity: z.number().int().nonnegative({ message: "Quantity must be a non-negative integer" }), // Will use default inference
  // costPerUnit: z.number().positive({ message: "Cost per unit must be a positive number" }), // Will use default inference
  batchNumber: z
    .string()
    .min(1, { message: 'Batch number cannot be empty if provided' })
    .optional(),
  // expiryDate: z.coerce.date().refine(date => date > new Date(), { message: "Expiry date must be in the future" }).optional(), // Will use default inference
});

// Schema for user operations
export const userSchema = createSelectSchema(users);
export const userInsertSchema = createInsertSchema(users, {
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email('Please provide a valid email address'),
  // role: z.string().refine(val => ["admin", "manager", "cashier", "affiliate"].includes(val), { // Will use default inference
  //   message: "Role must be one of: admin, manager, cashier, affiliate"
  // })
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
  // status: z.string().refine(val => ["active", "closed"].includes(val), { // Will use default inference
  //   message: "Status must be either 'active' or 'closed'"
  // }),
  // notes: z.string().optional() // Will use default inference
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
    // This direct Zod type seems to work for now
    message: 'Quantity must be greater than 0',
  }),
  // subtotal: (s) => s.subtotal.refine(val => parseFloat(val) >= 0, { // Will use default inference
  //   message: "Subtotal amount must be a positive number"
  // }),
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

// Create insert schemas for the new tables
export const affiliateInsertSchema = createInsertSchema(affiliates, {
  code: z.string().min(6, 'Referral code must be at least 6 characters'),
});

export const referralInsertSchema = createInsertSchema(referrals);

export const referralPaymentInsertSchema = createInsertSchema(referralPayments);

export const subscriptionInsertSchema = createInsertSchema(subscriptions);

// AiConversation types are already defined above

export type Affiliate = typeof affiliates.$inferSelect;
export type AffiliateInsert = z.infer<typeof affiliateInsertSchema>;

export type Referral = typeof referrals.$inferSelect;
export type ReferralInsert = z.infer<typeof referralInsertSchema>;

export type ReferralPayment = typeof referralPayments.$inferSelect;
export type ReferralPaymentInsert = z.infer<typeof referralPaymentInsertSchema>;

export type Subscription = typeof subscriptions.$inferSelect;
export type SubscriptionInsert = z.infer<typeof subscriptionInsertSchema>;

// Loyalty Program Schema
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
  customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  loyaltyId: text('loyalty_id').notNull().unique(), // Unique identifier for the member
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
  type: text('type').notNull(), // "earn", "redeem", "expire", "adjust"
  points: decimal('points', { precision: 10, scale: 2 }).notNull(),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  note: text('note'),
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

export const loyaltyMemberInsertSchema = createInsertSchema(loyaltyMembers);

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
    // Points can be negative for adjustments
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
