import { pgTable, serial, timestamp, text, integer, decimal, index } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { baseTable, baseInsertSchema, baseSelectSchema, commonValidators } from './base';
import { stores } from './stores';
import { products } from './products';
import { inventoryBatches } from './inventory';
import { users } from './users';
import { relations } from 'drizzle-orm';

// Transaction status enum
export const TransactionStatus = text('transaction_status').notNull();

// Payment status enum
export const PaymentStatus = text('payment_status').notNull();

// Payment method enum
export const PaymentMethod = text('payment_method').notNull();

export const transactions = pgTable(
  'transactions',
  {
    ...baseTable,
    _transactionId: serial('transaction_id').primaryKey(),
    _storeId: integer('store_id').references(() => stores.id),
    _userId: integer('user_id').references(() => users.id),
    _customerId: integer('customer_id').references(() => users.id),
    _cashierId: integer('cashier_id').references(() => users.id),
    _status: text('status').default('pending'),
    _totalAmount: decimal('total_amount').notNull(),
    _paymentStatus: text('payment_status').default('pending'),
    _paymentMethod: text('payment_method').default('cash'),
    _notes: text('notes'),
    _referenceNumber: text('reference_number').unique(),
    _referenceId: text('reference_id').unique()
  },
  table => ({
    _storeUserId: index('transactions_store_user_idx').on(table.storeId, table.userId),
    _paymentStatusIndex: index('transactions_payment_status_idx').on(table.paymentStatus),
    _statusIndex: index('transactions_status_idx').on(table.status)
  })
);

export const transactionItems = pgTable(
  'transaction_items',
  {
    ...baseTable,
    _transactionItemId: serial('transaction_item_id').primaryKey(),
    _transactionId: integer('transaction_id').references(() => transactions.transactionId),
    _productId: integer('product_id').references(() => products.id),
    _inventoryBatchId: integer('inventory_batch_id').references(() => inventoryBatches.id),
    _quantity: integer('quantity').notNull(),
    _unitPrice: decimal('unit_price').notNull(),
    _discount: decimal('discount'),
    _tax: decimal('tax'),
    _notes: text('notes'),
    _expiryDate: timestamp('expiry_date')
  },
  table => ({
    _transactionProductIndex: index('transaction_items_transaction_product_idx').on(
      table.transactionId,
      table.productId
    ),
    _expiryDateIndex: index('transaction_items_expiry_idx').on(table.expiryDate)
  })
);

export const transactionPayments = pgTable(
  'transaction_payments',
  {
    ...baseTable,
    _transactionPaymentId: serial('transaction_payment_id').primaryKey(),
    _transactionId: integer('transaction_id').references(() => transactions.transactionId),
    _amount: decimal('amount').notNull(),
    _paymentMethod: text('payment_method'),
    _referenceNumber: text('reference_number'),
    _notes: text('notes')
  },
  table => ({
    _transactionPaymentIndex: index('transaction_payments_transaction_idx').on(table.transactionId),
    _paymentMethodIndex: index('transaction_payments_method_idx').on(table.paymentMethod)
  })
);

// Validation schemas
export const transactionInsertSchema = baseInsertSchema.extend({
  _transactionId: z.number().int().optional(),
  _storeId: z.number().int().positive('Store ID must be positive'),
  _userId: z.number().int().positive('User ID must be positive'),
  _customerId: z.number().int().positive('Customer ID must be positive').optional(),
  _status: z.enum(['pending', 'completed', 'cancelled', 'failed']).default('pending'),
  _totalAmount: z
    .string()
    .refine(val => !isNaN(parseFloat(val)), {
      _message: 'Total amount must be a valid numeric string'
    }),
  _paymentStatus: z
    .enum(['pending', 'paid', 'partially_paid', 'overpaid', 'failed'])
    .default('pending'),
  _paymentMethod: z.enum(['cash', 'card', 'bank_transfer', 'mobile_money']).default('cash'),
  _notes: z.string().pipe(z.string().max(1000, 'Notes cannot exceed 1000 characters')).optional(),
  _referenceNumber: z
    .string()
    .min(1, 'Reference number is required')
    .pipe(z.string().max(50, 'Reference number cannot exceed 50 characters'))
});

export const transactionSelectSchema = baseSelectSchema.extend({
  _transactionId: z.number().int(),
  _storeId: z.number().int(),
  _userId: z.number().int(),
  _customerId: z.number().int().optional(),
  _status: z.enum(['pending', 'completed', 'cancelled', 'failed']),
  _totalAmount: z.number().min(0),
  _paymentStatus: z.enum(['pending', 'paid', 'partially_paid', 'overpaid', 'failed']),
  _paymentMethod: z.enum(['cash', 'card', 'bank_transfer', 'mobile_money']),
  _notes: z.string().optional(),
  _referenceNumber: z.string()
});

export const transactionItemInsertSchema = baseInsertSchema.extend({
  _transactionItemId: z.number().int().optional(),
  _transactionId: z.number().int().positive('Transaction ID must be positive'),
  _productId: z.number().int().positive('Product ID must be positive'),
  _inventoryBatchId: z.number().int().positive('Inventory batch ID must be positive'),
  _quantity: z
    .number()
    .int()
    .min(1, 'Quantity must be positive')
    .max(1000, 'Quantity cannot exceed 1000'),
  _unitPrice: z
    .string()
    .refine(val => !isNaN(parseFloat(val)), {
      _message: 'Unit price must be a valid numeric string'
    }),
  _discount: z
    .number()
    .min(0, 'Discount must be positive')
    .max(100, 'Discount cannot exceed 100%')
    .optional(),
  _tax: z.number().min(0, 'Tax must be positive').max(100, 'Tax cannot exceed 100%').optional(),
  _notes: z.string().pipe(z.string().max(500, 'Notes cannot exceed 500 characters')).optional()
});

export const transactionItemSelectSchema = baseSelectSchema.extend({
  _transactionItemId: z.number().int(),
  _transactionId: z.number().int(),
  _productId: z.number().int(),
  _inventoryBatchId: z.number().int(),
  _quantity: z.number().int(),
  _unitPrice: z.number(),
  _discount: z.number().optional(),
  _tax: z.number().optional(),
  _notes: z.string().optional()
});

export const transactionPaymentInsertSchema = baseInsertSchema.extend({
  _transactionPaymentId: z.number().int().optional(),
  _transactionId: z.number().int().positive('Transaction ID must be positive'),
  _amount: z
    .number()
    .min(0, 'Amount must be positive')
    .max(1000000, 'Amount cannot exceed 1,000,000'),
  _paymentMethod: z.enum(['cash', 'card', 'bank_transfer', 'mobile_money']).default('cash'),
  _referenceNumber: z
    .string()
    .min(1, 'Reference number is required')
    .pipe(z.string().max(50, 'Reference number cannot exceed 50 characters')),
  _notes: z.string().pipe(z.string().max(500, 'Notes cannot exceed 500 characters')).optional()
});

export const transactionPaymentSelectSchema = baseSelectSchema.extend({
  _transactionPaymentId: z.number().int(),
  _transactionId: z.number().int(),
  _amount: z.number(),
  _paymentMethod: z.enum(['cash', 'card', 'bank_transfer', 'mobile_money']),
  _referenceNumber: z.string().optional(),
  _notes: z.string().optional()
});

// Relations
export const transactionRelations = relations(transactions, helpers => ({
  _store: helpers.one(stores, {
    _fields: [transactions.storeId],
    _references: [stores.id]
  }),
  _user: helpers.one(users, {
    _fields: [transactions.userId],
    _references: [users.id]
  }),
  _customer: helpers.one(users, {
    _fields: [transactions.customerId],
    _references: [users.id]
  }),
  _items: helpers.many(transactionItems),
  _payments: helpers.many(transactionPayments)
}));

export const transactionItemRelations = relations(transactionItems, helpers => ({
  _transaction: helpers.one(transactions, {
    _fields: [transactionItems.transactionId],
    _references: [transactions.transactionId]
  }),
  _product: helpers.one(products, {
    _fields: [transactionItems.productId],
    _references: [products.id]
  }),
  _inventoryBatch: helpers.one(inventoryBatches, {
    _fields: [transactionItems.inventoryBatchId],
    _references: [inventoryBatches.id]
  })
}));

export const transactionPaymentRelations = relations(transactionPayments, helpers => ({
  _transaction: helpers.one(transactions, {
    _fields: [transactionPayments.transactionId],
    _references: [transactions.transactionId]
  })
}));

export type TransactionItem = z.infer<typeof transactionItemSelectSchema>;
export type TransactionItemInsert = z.infer<typeof transactionItemInsertSchema>;
