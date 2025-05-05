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
}));

// Transaction Items
export const transactionItems = pgTable("transaction_items", {
  id: serial("id").primaryKey(),
  transactionId: integer("transaction_id").references(() => transactions.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const transactionItemsRelations = relations(transactionItems, ({ one }) => ({
  transaction: one(transactions, {
    fields: [transactionItems.transactionId],
    references: [transactions.id],
  }),
  product: one(products, {
    fields: [transactionItems.productId],
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
  role: (schema) => schema.refine(val => ['cashier', 'manager', 'admin'].includes(val), {
    message: "Role must be one of: cashier, manager, admin"
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

export type AiConversation = typeof aiConversations.$inferSelect;
export type AiConversationInsert = typeof aiConversations.$inferInsert;

export type LoginData = z.infer<typeof loginSchema>;
