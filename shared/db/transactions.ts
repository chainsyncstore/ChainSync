import { pgTable, serial, timestamp, text, integer, decimal, index } from "drizzle-orm/pg-core";
import { z } from "zod";
import { baseTable, baseInsertSchema, baseSelectSchema, commonValidators } from "./base";
import { stores } from "./stores";
import { products } from "./products";
import { inventoryBatches } from "./inventory";
import { users } from "./users";
import { relations } from "drizzle-orm";

// Transaction status enum
export const TransactionStatus = text("transaction_status").notNull();

// Payment status enum
export const PaymentStatus = text("payment_status").notNull();

// Payment method enum
export const PaymentMethod = text("payment_method").notNull();

export const transactions = pgTable("transactions", {
  cashierId: integer("cashier_id").references(() => users.id), 
  total: decimal("total").notNull(), 
  ...baseTable,
  transactionId: serial("transaction_id").primaryKey(),
  storeId: integer("store_id").references(() => stores.id),
  userId: integer("user_id").references(() => users.id),
  customerId: integer("customer_id").references(() => users.id),
  status: text("status").default("pending"),
  totalAmount: decimal("total_amount").notNull(),
  paymentStatus: text("payment_status").default("pending"),
  paymentMethod: text("payment_method").default("cash"),
  notes: text("notes"),
  referenceNumber: text("reference_number").unique(),
}, (table) => ({
  storeUserId: index("transactions_store_user_idx").on(table.storeId, table.userId),
  paymentStatusIndex: index("transactions_payment_status_idx").on(table.paymentStatus),
  statusIndex: index("transactions_status_idx").on(table.status),
}));

export const transactionItems = pgTable("transaction_items", {
  ...baseTable,
  transactionItemId: serial("transaction_item_id").primaryKey(),
  transactionId: integer("transaction_id").references(() => transactions.transactionId),
  productId: integer("product_id").references(() => products.id),
  inventoryBatchId: integer("inventory_batch_id").references(() => inventoryBatches.id),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price").notNull(),
  discount: decimal("discount"),
  tax: decimal("tax"),
  notes: text("notes"),
  expiryDate: timestamp("expiry_date"),
}, (table) => ({
  transactionProductIndex: index("transaction_items_transaction_product_idx").on(table.transactionId, table.productId),
  expiryDateIndex: index("transaction_items_expiry_idx").on(table.expiryDate),
}));

export const transactionPayments = pgTable("transaction_payments", {
  ...baseTable,
  transactionPaymentId: serial("transaction_payment_id").primaryKey(),
  transactionId: integer("transaction_id").references(() => transactions.transactionId),
  amount: decimal("amount").notNull(),
  paymentMethod: text("payment_method"),
  referenceNumber: text("reference_number"),
  notes: text("notes"),
}, (table) => ({
  transactionPaymentIndex: index("transaction_payments_transaction_idx").on(table.transactionId),
  paymentMethodIndex: index("transaction_payments_method_idx").on(table.paymentMethod),
}));

// Validation schemas
export const transactionInsertSchema = baseInsertSchema.extend({
  transactionId: z.number().int().optional(),
  storeId: z.number().int().positive("Store ID must be positive"),
  userId: z.number().int().positive("User ID must be positive").optional(), // Made optional as cashierId might be used
  cashierId: z.number().int().positive("Cashier ID must be positive").optional(), // Made optional as userId might be used
  customerId: z.number().int().positive("Customer ID must be positive").optional(),
  status: z.enum(["pending", "completed", "cancelled", "failed"]).default("pending"),
  total: z.number().min(0, "Total must be positive").max(1000000, "Total cannot exceed 1,000,000"), // Added total
  totalAmount: z.number().min(0, "Total amount must be positive").max(1000000, "Total amount cannot exceed 1,000,000"),
  paymentStatus: z.enum(["pending", "paid", "partially_paid", "overpaid", "failed"]).default("pending"),
  paymentMethod: z.enum(["cash", "card", "bank_transfer", "mobile_money"]).default("cash"),
  notes: z.string().pipe(z.string().max(1000, "Notes cannot exceed 1000 characters")).optional(),
  referenceNumber: z.string().min(1, "Reference number is required").pipe(z.string().max(50, "Reference number cannot exceed 50 characters")).optional(), // Made optional as it might be auto-generated
});

export const transactionSelectSchema = baseSelectSchema.extend({
  transactionId: z.number().int(),
  storeId: z.number().int(),
  userId: z.number().int().optional(),
  cashierId: z.number().int().optional(),
  customerId: z.number().int().optional(),
  status: z.enum(["pending", "completed", "cancelled", "failed"]),
  total: z.number().min(0), // Added total
  totalAmount: z.number().min(0),
  paymentStatus: z.enum(["pending", "paid", "partially_paid", "overpaid", "failed"]),
  paymentMethod: z.enum(["cash", "card", "bank_transfer", "mobile_money"]),
  notes: z.string().optional(),
  referenceNumber: z.string().optional(),
});

export const transactionItemInsertSchema = baseInsertSchema.extend({
  transactionItemId: z.number().int().optional(),
  transactionId: z.number().int().positive("Transaction ID must be positive"),
  productId: z.number().int().positive("Product ID must be positive"),
  inventoryBatchId: z.number().int().positive("Inventory batch ID must be positive").optional(), // Made optional
  quantity: z.number().int().min(1, "Quantity must be positive").max(1000, "Quantity cannot exceed 1000"),
  unitPrice: z.number().min(0, "Unit price must be positive").max(100000, "Unit price cannot exceed 100,000"), // Zod expects number, Drizzle handles decimal conversion
  discount: z.number().min(0, "Discount must be positive").max(100, "Discount cannot exceed 100%").optional(),
  tax: z.number().min(0, "Tax must be positive").max(100, "Tax cannot exceed 100%").optional(),
  notes: z.string().pipe(z.string().max(500, "Notes cannot exceed 500 characters")).optional(),
  expiryDate: z.date().optional(), // Added from table schema
});

export const transactionItemSelectSchema = baseSelectSchema.extend({
  transactionItemId: z.number().int(),
  transactionId: z.number().int(),
  productId: z.number().int(),
  inventoryBatchId: z.number().int().optional(),
  quantity: z.number().int(),
  unitPrice: z.number(),
  discount: z.number().optional(),
  tax: z.number().optional(),
  notes: z.string().optional(),
  expiryDate: z.date().optional(),
});

export const transactionPaymentInsertSchema = baseInsertSchema.extend({
  transactionPaymentId: z.number().int().optional(),
  transactionId: z.number().int().positive("Transaction ID must be positive"),
  amount: z.number().min(0, "Amount must be positive").max(1000000, "Amount cannot exceed 1,000,000"),
  paymentMethod: z.enum(["cash", "card", "bank_transfer", "mobile_money"]).default("cash"),
  referenceNumber: z.string().min(1, "Reference number is required").pipe(z.string().max(50, "Reference number cannot exceed 50 characters")).optional(),
  notes: z.string().pipe(z.string().max(500, "Notes cannot exceed 500 characters")).optional(),
});

export const transactionPaymentSelectSchema = baseSelectSchema.extend({
  transactionPaymentId: z.number().int(),
  transactionId: z.number().int(),
  amount: z.number(),
  paymentMethod: z.enum(["cash", "card", "bank_transfer", "mobile_money"]),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});

// Relations
export const transactionRelations = relations(transactions, (helpers) => ({
  store: helpers.one(stores, {
    fields: [transactions.storeId],
    references: [stores.id],
  }),
  user: helpers.one(users, { // This is the general user who might have initiated (e.g. online order)
    fields: [transactions.userId],
    references: [users.id],
  }),
  cashier: helpers.one(users, { // This is the cashier who processed at POS
    fields: [transactions.cashierId],
    references: [users.id],
  }),
  customer: helpers.one(users, { // This is the customer associated with the transaction
    fields: [transactions.customerId],
    references: [users.id],
  }),
  items: helpers.many(transactionItems),
  payments: helpers.many(transactionPayments),
}));

export const transactionItemRelations = relations(transactionItems, (helpers) => ({
  transaction: helpers.one(transactions, {
    fields: [transactionItems.transactionId],
    references: [transactions.transactionId],
  }),
  product: helpers.one(products, {
    fields: [transactionItems.productId],
    references: [products.id],
  }),
  inventoryBatch: helpers.one(inventoryBatches, {
    fields: [transactionItems.inventoryBatchId],
    references: [inventoryBatches.id],
  }),
}));

export const transactionPaymentRelations = relations(transactionPayments, (helpers) => ({
  transaction: helpers.one(transactions, {
    fields: [transactionPayments.transactionId],
    references: [transactions.transactionId],
  }),
}));

export type TransactionItem = z.infer<typeof transactionItemSelectSchema>;
export type TransactionItemInsert = z.infer<typeof transactionItemInsertSchema>;
export type Transaction = z.infer<typeof transactionSelectSchema>;
export type TransactionInsert = z.infer<typeof transactionInsertSchema>;
