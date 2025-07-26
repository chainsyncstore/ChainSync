"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transactionPaymentRelations = exports.transactionItemRelations = exports.transactionRelations = exports.transactionPaymentSelectSchema = exports.transactionPaymentInsertSchema = exports.transactionItemSelectSchema = exports.transactionItemInsertSchema = exports.transactionSelectSchema = exports.transactionInsertSchema = exports.transactionPayments = exports.transactionItems = exports.transactions = exports.PaymentMethod = exports.PaymentStatus = exports.TransactionStatus = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const zod_1 = require("zod");
const base_1 = require("./base");
const stores_1 = require("./stores");
const products_1 = require("./products");
const inventory_1 = require("./inventory");
const users_1 = require("./users");
const drizzle_orm_1 = require("drizzle-orm");
// Transaction status enum
exports.TransactionStatus = (0, pg_core_1.text)('transaction_status').notNull();
// Payment status enum
exports.PaymentStatus = (0, pg_core_1.text)('payment_status').notNull();
// Payment method enum
exports.PaymentMethod = (0, pg_core_1.text)('payment_method').notNull();
exports.transactions = (0, pg_core_1.pgTable)('transactions', {
    ...base_1.baseTable,
    transactionId: (0, pg_core_1.serial)('transaction_id').primaryKey(),
    storeId: (0, pg_core_1.integer)('store_id').references(() => stores_1.stores.id),
    userId: (0, pg_core_1.integer)('user_id').references(() => users_1.users.id),
    customerId: (0, pg_core_1.integer)('customer_id').references(() => users_1.users.id),
    cashierId: (0, pg_core_1.integer)('cashier_id').references(() => users_1.users.id),
    status: (0, pg_core_1.text)('status').default('pending'),
    totalAmount: (0, pg_core_1.decimal)('total_amount').notNull(),
    paymentStatus: (0, pg_core_1.text)('payment_status').default('pending'),
    paymentMethod: (0, pg_core_1.text)('payment_method').default('cash'),
    notes: (0, pg_core_1.text)('notes'),
    referenceNumber: (0, pg_core_1.text)('reference_number').unique(),
    referenceId: (0, pg_core_1.text)('reference_id').unique(),
}, table => ({
    storeUserId: (0, pg_core_1.index)('transactions_store_user_idx').on(table.storeId, table.userId),
    paymentStatusIndex: (0, pg_core_1.index)('transactions_payment_status_idx').on(table.paymentStatus),
    statusIndex: (0, pg_core_1.index)('transactions_status_idx').on(table.status),
}));
exports.transactionItems = (0, pg_core_1.pgTable)('transaction_items', {
    ...base_1.baseTable,
    transactionItemId: (0, pg_core_1.serial)('transaction_item_id').primaryKey(),
    transactionId: (0, pg_core_1.integer)('transaction_id').references(() => exports.transactions.transactionId),
    productId: (0, pg_core_1.integer)('product_id').references(() => products_1.products.id),
    inventoryBatchId: (0, pg_core_1.integer)('inventory_batch_id').references(() => inventory_1.inventoryBatches.id),
    quantity: (0, pg_core_1.integer)('quantity').notNull(),
    unitPrice: (0, pg_core_1.decimal)('unit_price').notNull(),
    discount: (0, pg_core_1.decimal)('discount'),
    tax: (0, pg_core_1.decimal)('tax'),
    notes: (0, pg_core_1.text)('notes'),
    expiryDate: (0, pg_core_1.timestamp)('expiry_date'),
}, table => ({
    transactionProductIndex: (0, pg_core_1.index)('transaction_items_transaction_product_idx').on(table.transactionId, table.productId),
    expiryDateIndex: (0, pg_core_1.index)('transaction_items_expiry_idx').on(table.expiryDate),
}));
exports.transactionPayments = (0, pg_core_1.pgTable)('transaction_payments', {
    ...base_1.baseTable,
    transactionPaymentId: (0, pg_core_1.serial)('transaction_payment_id').primaryKey(),
    transactionId: (0, pg_core_1.integer)('transaction_id').references(() => exports.transactions.transactionId),
    amount: (0, pg_core_1.decimal)('amount').notNull(),
    paymentMethod: (0, pg_core_1.text)('payment_method'),
    referenceNumber: (0, pg_core_1.text)('reference_number'),
    notes: (0, pg_core_1.text)('notes'),
}, table => ({
    transactionPaymentIndex: (0, pg_core_1.index)('transaction_payments_transaction_idx').on(table.transactionId),
    paymentMethodIndex: (0, pg_core_1.index)('transaction_payments_method_idx').on(table.paymentMethod),
}));
// Validation schemas
exports.transactionInsertSchema = base_1.baseInsertSchema.extend({
    transactionId: zod_1.z.number().int().optional(),
    storeId: zod_1.z.number().int().positive('Store ID must be positive'),
    userId: zod_1.z.number().int().positive('User ID must be positive'),
    customerId: zod_1.z.number().int().positive('Customer ID must be positive').optional(),
    status: zod_1.z.enum(['pending', 'completed', 'cancelled', 'failed']).default('pending'),
    totalAmount: zod_1.z
        .string()
        .refine(val => !isNaN(parseFloat(val)), {
        message: 'Total amount must be a valid numeric string',
    }),
    paymentStatus: zod_1.z
        .enum(['pending', 'paid', 'partially_paid', 'overpaid', 'failed'])
        .default('pending'),
    paymentMethod: zod_1.z.enum(['cash', 'card', 'bank_transfer', 'mobile_money']).default('cash'),
    notes: zod_1.z.string().pipe(zod_1.z.string().max(1000, 'Notes cannot exceed 1000 characters')).optional(),
    referenceNumber: zod_1.z
        .string()
        .min(1, 'Reference number is required')
        .pipe(zod_1.z.string().max(50, 'Reference number cannot exceed 50 characters')),
});
exports.transactionSelectSchema = base_1.baseSelectSchema.extend({
    transactionId: zod_1.z.number().int(),
    storeId: zod_1.z.number().int(),
    userId: zod_1.z.number().int(),
    customerId: zod_1.z.number().int().optional(),
    status: zod_1.z.enum(['pending', 'completed', 'cancelled', 'failed']),
    totalAmount: zod_1.z.number().min(0),
    paymentStatus: zod_1.z.enum(['pending', 'paid', 'partially_paid', 'overpaid', 'failed']),
    paymentMethod: zod_1.z.enum(['cash', 'card', 'bank_transfer', 'mobile_money']),
    notes: zod_1.z.string().optional(),
    referenceNumber: zod_1.z.string(),
});
exports.transactionItemInsertSchema = base_1.baseInsertSchema.extend({
    transactionItemId: zod_1.z.number().int().optional(),
    transactionId: zod_1.z.number().int().positive('Transaction ID must be positive'),
    productId: zod_1.z.number().int().positive('Product ID must be positive'),
    inventoryBatchId: zod_1.z.number().int().positive('Inventory batch ID must be positive'),
    quantity: zod_1.z
        .number()
        .int()
        .min(1, 'Quantity must be positive')
        .max(1000, 'Quantity cannot exceed 1000'),
    unitPrice: zod_1.z
        .string()
        .refine(val => !isNaN(parseFloat(val)), {
        message: 'Unit price must be a valid numeric string',
    }),
    discount: zod_1.z
        .number()
        .min(0, 'Discount must be positive')
        .max(100, 'Discount cannot exceed 100%')
        .optional(),
    tax: zod_1.z.number().min(0, 'Tax must be positive').max(100, 'Tax cannot exceed 100%').optional(),
    notes: zod_1.z.string().pipe(zod_1.z.string().max(500, 'Notes cannot exceed 500 characters')).optional(),
});
exports.transactionItemSelectSchema = base_1.baseSelectSchema.extend({
    transactionItemId: zod_1.z.number().int(),
    transactionId: zod_1.z.number().int(),
    productId: zod_1.z.number().int(),
    inventoryBatchId: zod_1.z.number().int(),
    quantity: zod_1.z.number().int(),
    unitPrice: zod_1.z.number(),
    discount: zod_1.z.number().optional(),
    tax: zod_1.z.number().optional(),
    notes: zod_1.z.string().optional(),
});
exports.transactionPaymentInsertSchema = base_1.baseInsertSchema.extend({
    transactionPaymentId: zod_1.z.number().int().optional(),
    transactionId: zod_1.z.number().int().positive('Transaction ID must be positive'),
    amount: zod_1.z
        .number()
        .min(0, 'Amount must be positive')
        .max(1000000, 'Amount cannot exceed 1,000,000'),
    paymentMethod: zod_1.z.enum(['cash', 'card', 'bank_transfer', 'mobile_money']).default('cash'),
    referenceNumber: zod_1.z
        .string()
        .min(1, 'Reference number is required')
        .pipe(zod_1.z.string().max(50, 'Reference number cannot exceed 50 characters')),
    notes: zod_1.z.string().pipe(zod_1.z.string().max(500, 'Notes cannot exceed 500 characters')).optional(),
});
exports.transactionPaymentSelectSchema = base_1.baseSelectSchema.extend({
    transactionPaymentId: zod_1.z.number().int(),
    transactionId: zod_1.z.number().int(),
    amount: zod_1.z.number(),
    paymentMethod: zod_1.z.enum(['cash', 'card', 'bank_transfer', 'mobile_money']),
    referenceNumber: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
});
// Relations
exports.transactionRelations = (0, drizzle_orm_1.relations)(exports.transactions, helpers => ({
    store: helpers.one(stores_1.stores, {
        fields: [exports.transactions.storeId],
        references: [stores_1.stores.id],
    }),
    user: helpers.one(users_1.users, {
        fields: [exports.transactions.userId],
        references: [users_1.users.id],
    }),
    customer: helpers.one(users_1.users, {
        fields: [exports.transactions.customerId],
        references: [users_1.users.id],
    }),
    items: helpers.many(exports.transactionItems),
    payments: helpers.many(exports.transactionPayments),
}));
exports.transactionItemRelations = (0, drizzle_orm_1.relations)(exports.transactionItems, helpers => ({
    transaction: helpers.one(exports.transactions, {
        fields: [exports.transactionItems.transactionId],
        references: [exports.transactions.transactionId],
    }),
    product: helpers.one(products_1.products, {
        fields: [exports.transactionItems.productId],
        references: [products_1.products.id],
    }),
    inventoryBatch: helpers.one(inventory_1.inventoryBatches, {
        fields: [exports.transactionItems.inventoryBatchId],
        references: [inventory_1.inventoryBatches.id],
    }),
}));
exports.transactionPaymentRelations = (0, drizzle_orm_1.relations)(exports.transactionPayments, helpers => ({
    transaction: helpers.one(exports.transactions, {
        fields: [exports.transactionPayments.transactionId],
        references: [exports.transactions.transactionId],
    }),
}));
