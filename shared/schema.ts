import { pgTable, text, serial, integer, boolean, timestamp, decimal, json, jsonb, unique } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { z } from "zod";

// Users & Authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("cashier"), // cashier, manager, admin
  storeId: integer("store_id"), // null for admin (chain-wide access)
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ one }) => ({
  store: one(stores, {
    fields: [users.storeId],
    references: [stores.id],
  }),
}));

// Stores
export const stores = pgTable("stores", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zipCode: text("zip_code").notNull(),
  phone: text("phone").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const storesRelations = relations(stores, ({ many }) => ({
  users: many(users),
  inventory: many(inventory),
  transactions: many(transactions),
}));

// Product Categories
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

// Products
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  barcode: text("barcode").notNull().unique(),
  categoryId: integer("category_id").references(() => categories.id).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  cost: decimal("cost", { precision: 10, scale: 2 }).notNull(),
  isPerishable: boolean("is_perishable").notNull().default(false),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  inventoryItems: many(inventory),
  transactionItems: many(transactionItems),
}));

// Inventory
export const inventory = pgTable("inventory", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => stores.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").notNull().default(0),
  minimumLevel: integer("minimum_level").notNull().default(10),
  batchNumber: text("batch_number"),
  expiryDate: timestamp("expiry_date"),
  lastStockUpdate: timestamp("last_stock_update").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    storeProductUnique: unique().on(table.storeId, table.productId),
  }
});

export const inventoryRelations = relations(inventory, ({ one }) => ({
  store: one(stores, {
    fields: [inventory.storeId],
    references: [stores.id],
  }),
  product: one(products, {
    fields: [inventory.productId],
    references: [products.id],
  }),
}));

// Suppliers
export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  purchaseOrders: many(purchaseOrders),
}));

// Purchase Orders
export const purchaseOrders = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => stores.id).notNull(),
  supplierId: integer("supplier_id").references(() => suppliers.id).notNull(),
  status: text("status").notNull().default("pending"), // pending, approved, received, cancelled
  createdBy: integer("created_by").references(() => users.id).notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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
export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: serial("id").primaryKey(),
  purchaseOrderId: integer("purchase_order_id").references(() => purchaseOrders.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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

// Transactions (Sales)
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  transactionId: text("transaction_id").notNull().unique(), // e.g., TRX-12345
  storeId: integer("store_id").references(() => stores.id).notNull(),
  cashierId: integer("cashier_id").references(() => users.id).notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  tax: decimal("tax", { precision: 10, scale: 2 }).notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull(), // cash, credit_card, debit_card, etc.
  status: text("status").notNull().default("completed"), // completed, pending, voided
  isOfflineTransaction: boolean("is_offline_transaction").notNull().default(false),
  syncedAt: timestamp("synced_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  store: one(stores, {
    fields: [transactions.storeId],
    references: [stores.id],
  }),
  cashier: one(users, {
    fields: [transactions.cashierId],
    references: [users.id],
  }),
  items: many(transactionItems),
  refunds: many(refunds),
}));

// Transaction Items
export const transactionItems = pgTable("transaction_items", {
  id: serial("id").primaryKey(),
  transactionId: integer("transaction_id").references(() => transactions.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  returnedQuantity: integer("returned_quantity").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const transactionItemsRelations = relations(transactionItems, ({ one, many }) => ({
  transaction: one(transactions, {
    fields: [transactionItems.transactionId],
    references: [transactions.id],
  }),
  product: one(products, {
    fields: [transactionItems.productId],
    references: [products.id],
  }),
  refundItems: many(refundItems),
}));

// Refunds
export const refunds = pgTable("refunds", {
  id: serial("id").primaryKey(),
  refundId: text("refund_id").notNull().unique(), // e.g., REF-12345
  transactionId: integer("transaction_id").references(() => transactions.id).notNull(),
  storeId: integer("store_id").references(() => stores.id).notNull(),
  processedById: integer("processed_by_id").references(() => users.id).notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  tax: decimal("tax", { precision: 10, scale: 2 }).notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  refundMethod: text("refund_method").notNull(), // cash, credit_card, store_credit, etc.
  reason: text("reason").notNull(), // damaged, unwanted, defective, etc.
  status: text("status").notNull().default("completed"), // completed, pending, voided
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const refundsRelations = relations(refunds, ({ one, many }) => ({
  transaction: one(transactions, {
    fields: [refunds.transactionId],
    references: [transactions.id],
  }),
  store: one(stores, {
    fields: [refunds.storeId],
    references: [stores.id],
  }),
  processedBy: one(users, {
    fields: [refunds.processedById],
    references: [users.id],
  }),
  items: many(refundItems),
}));

// Refund Items
export const refundItems = pgTable("refund_items", {
  id: serial("id").primaryKey(),
  refundId: integer("refund_id").references(() => refunds.id).notNull(),
  transactionItemId: integer("transaction_item_id").references(() => transactionItems.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  isRestocked: boolean("is_restocked").notNull().default(false), // Indicates if non-perishable item was returned to inventory
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const refundItemsRelations = relations(refundItems, ({ one }) => ({
  refund: one(refunds, {
    fields: [refundItems.refundId],
    references: [refunds.id],
  }),
  transactionItem: one(transactionItems, {
    fields: [refundItems.transactionItemId],
    references: [transactionItems.id],
  }),
  product: one(products, {
    fields: [refundItems.productId],
    references: [products.id],
  }),
}));

// AI Assistant Conversations
export const aiConversations = pgTable("ai_conversations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  messages: jsonb("messages").notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const aiConversationsRelations = relations(aiConversations, ({ one }) => ({
  user: one(users, {
    fields: [aiConversations.userId],
    references: [users.id],
  }),
}));

// Validation Schemas
export const userInsertSchema = createInsertSchema(users, {
  fullName: (schema) => schema.min(2, "Full name must be at least 2 characters"),
  email: (schema) => schema.email("Must provide a valid email"),
  password: (schema) => schema.min(6, "Password must be at least 6 characters"),
  role: (schema) => schema.refine(val => ['cashier', 'manager', 'admin', 'affiliate'].includes(val), {
    message: "Role must be one of: cashier, manager, admin, affiliate"
  }),
});

export const storeInsertSchema = createInsertSchema(stores, {
  name: (schema) => schema.min(2, "Store name must be at least 2 characters"),
  phone: (schema) => schema.min(10, "Phone number must be at least 10 characters"),
});

export const categoryInsertSchema = createInsertSchema(categories, {
  name: (schema) => schema.min(2, "Category name must be at least 2 characters"),
});

export const productInsertSchema = createInsertSchema(products, {
  name: (schema) => schema.min(2, "Product name must be at least 2 characters"),
  barcode: (schema) => schema.min(4, "Barcode must be at least 4 characters"),
  price: (schema) => schema.refine(val => parseFloat(val) >= 0, {
    message: "Price must be a positive number"
  }),
  cost: (schema) => schema.refine(val => parseFloat(val) >= 0, {
    message: "Cost must be a positive number"
  }),
});

export const inventoryInsertSchema = createInsertSchema(inventory, {
  quantity: (schema) => schema.refine(val => val >= 0, {
    message: "Quantity must be a positive number"
  }),
  minimumLevel: (schema) => schema.refine(val => val >= 0, {
    message: "Minimum level must be a positive number"
  }),
});

export const transactionInsertSchema = createInsertSchema(transactions, {
  transactionId: (schema) => schema.min(5, "Transaction ID must be at least 5 characters"),
  subtotal: (schema) => schema.refine(val => parseFloat(val) >= 0, {
    message: "Subtotal must be a positive number"
  }),
  tax: (schema) => schema.refine(val => parseFloat(val) >= 0, {
    message: "Tax must be a positive number"
  }),
  total: (schema) => schema.refine(val => parseFloat(val) >= 0, {
    message: "Total must be a positive number"
  }),
});

export const transactionItemInsertSchema = createInsertSchema(transactionItems, {
  quantity: (schema) => schema.refine(val => val > 0, {
    message: "Quantity must be greater than 0"
  }),
  unitPrice: (schema) => schema.refine(val => parseFloat(val) >= 0, {
    message: "Unit price must be a positive number"
  }),
  subtotal: (schema) => schema.refine(val => parseFloat(val) >= 0, {
    message: "Subtotal must be a positive number"
  }),
});

export const refundInsertSchema = createInsertSchema(refunds, {
  refundId: (schema) => schema.min(5, "Refund ID must be at least 5 characters"),
  subtotal: (schema) => schema.refine(val => parseFloat(val) >= 0, {
    message: "Subtotal must be a positive number"
  }),
  tax: (schema) => schema.refine(val => parseFloat(val) >= 0, {
    message: "Tax must be a positive number"
  }),
  total: (schema) => schema.refine(val => parseFloat(val) >= 0, {
    message: "Total must be a positive number"
  }),
  reason: (schema) => schema.min(2, "Reason must be at least 2 characters"),
});

export const refundItemInsertSchema = createInsertSchema(refundItems, {
  quantity: (schema) => schema.refine(val => val > 0, {
    message: "Quantity must be greater than 0"
  }),
  unitPrice: (schema) => schema.refine(val => parseFloat(val) >= 0, {
    message: "Unit price must be a positive number"
  }),
  subtotal: (schema) => schema.refine(val => parseFloat(val) >= 0, {
    message: "Subtotal must be a positive number"
  }),
});

// Login schema
export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

// Type exports
export type User = typeof users.$inferSelect;
export type UserInsert = z.infer<typeof userInsertSchema>;

export type Store = typeof stores.$inferSelect;
export type StoreInsert = z.infer<typeof storeInsertSchema>;

export type Category = typeof categories.$inferSelect;
export type CategoryInsert = z.infer<typeof categoryInsertSchema>;

export type Product = typeof products.$inferSelect;
export type ProductInsert = z.infer<typeof productInsertSchema>;

export type Inventory = typeof inventory.$inferSelect;
export type InventoryInsert = z.infer<typeof inventoryInsertSchema>;

export type Supplier = typeof suppliers.$inferSelect;
export type SupplierInsert = typeof suppliers.$inferSelect;

export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type PurchaseOrderInsert = typeof purchaseOrders.$inferInsert;

export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type PurchaseOrderItemInsert = typeof purchaseOrderItems.$inferInsert;

export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = z.infer<typeof transactionInsertSchema>;

export type TransactionItem = typeof transactionItems.$inferSelect;
export type TransactionItemInsert = z.infer<typeof transactionItemInsertSchema>;

export type Refund = typeof refunds.$inferSelect;
export type RefundInsert = z.infer<typeof refundInsertSchema>;

export type RefundItem = typeof refundItems.$inferSelect;
export type RefundItemInsert = z.infer<typeof refundItemInsertSchema>;

// Affiliate Program Schema
export const affiliates = pgTable("affiliates", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  code: text("code").notNull().unique(),
  totalReferrals: integer("total_referrals").default(0).notNull(),
  totalEarnings: decimal("total_earnings", { precision: 10, scale: 2 }).default("0").notNull(),
  pendingEarnings: decimal("pending_earnings", { precision: 10, scale: 2 }).default("0").notNull(),
  bankName: text("bank_name"),
  accountNumber: text("account_number"),
  accountName: text("account_name"),
  bankCode: text("bank_code"),
  paymentMethod: text("payment_method").default("paystack"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const affiliatesRelations = relations(affiliates, ({ one }) => ({
  user: one(users, { fields: [affiliates.userId], references: [users.id] })
}));

export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  affiliateId: integer("affiliate_id").references(() => affiliates.id).notNull(),
  referredUserId: integer("referred_user_id").references(() => users.id).notNull(),
  status: text("status").default("pending").notNull(), // pending, active, completed, cancelled
  discountApplied: boolean("discount_applied").default(false).notNull(),
  commissionPaid: boolean("commission_paid").default(false).notNull(),
  signupDate: timestamp("signup_date").defaultNow().notNull(),
  activationDate: timestamp("activation_date"),
  expiryDate: timestamp("expiry_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const referralsRelations = relations(referrals, ({ one }) => ({
  affiliate: one(affiliates, { fields: [referrals.affiliateId], references: [affiliates.id] }),
  referredUser: one(users, { fields: [referrals.referredUserId], references: [users.id] })
}));

export const referralPayments = pgTable("referral_payments", {
  id: serial("id").primaryKey(),
  affiliateId: integer("affiliate_id").references(() => affiliates.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("NGN").notNull(),
  status: text("status").default("pending").notNull(), // pending, completed, failed
  paymentMethod: text("payment_method").default("paystack").notNull(),
  transactionReference: text("transaction_reference"),
  paymentDate: timestamp("payment_date"),
  metadata: text("metadata"), // JSON string with additional data
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const referralPaymentsRelations = relations(referralPayments, ({ one }) => ({
  affiliate: one(affiliates, { fields: [referralPayments.affiliateId], references: [affiliates.id] })
}));

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  plan: text("plan").notNull(), // basic, pro, enterprise
  status: text("status").default("active").notNull(), // active, cancelled, expired
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("NGN").notNull(),
  referralCode: text("referral_code"),
  discountApplied: boolean("discount_applied").default(false).notNull(),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default("0").notNull(),
  startDate: timestamp("start_date").defaultNow().notNull(),
  endDate: timestamp("end_date").notNull(),
  autoRenew: boolean("auto_renew").default(true).notNull(),
  paymentProvider: text("payment_provider").default("paystack").notNull(),
  paymentReference: text("payment_reference"),
  metadata: text("metadata"), // JSON string with additional data
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, { fields: [subscriptions.userId], references: [users.id] })
}));

// Create insert schemas for the new tables
export const affiliateInsertSchema = createInsertSchema(affiliates, {
  code: (schema) => schema.min(6, "Referral code must be at least 6 characters")
});

export const referralInsertSchema = createInsertSchema(referrals);

export const referralPaymentInsertSchema = createInsertSchema(referralPayments);

export const subscriptionInsertSchema = createInsertSchema(subscriptions);

export type AiConversation = typeof aiConversations.$inferSelect;
export type AiConversationInsert = typeof aiConversations.$inferInsert;

export type Affiliate = typeof affiliates.$inferSelect;
export type AffiliateInsert = z.infer<typeof affiliateInsertSchema>;

export type Referral = typeof referrals.$inferSelect;
export type ReferralInsert = z.infer<typeof referralInsertSchema>;

export type ReferralPayment = typeof referralPayments.$inferSelect;
export type ReferralPaymentInsert = z.infer<typeof referralPaymentInsertSchema>;

export type Subscription = typeof subscriptions.$inferSelect;
export type SubscriptionInsert = z.infer<typeof subscriptionInsertSchema>;

export type LoginData = z.infer<typeof loginSchema>;
