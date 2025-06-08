/**
 * Schema Validation Utilities
 *
 * This file provides centralized validation utilities for the application schema,
 * replacing ad-hoc type assertions with robust runtime validation.
 */

import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

import * as schema from './schema.js';
import { AppError } from './types/errors.js'; // Added AppError import

/**
 * Error class for schema validation failures
 */
export class SchemaValidationError extends Error {
  public readonly field?: string;
  public readonly code: string;
  public readonly path?: string[];
  public readonly issues?: z.ZodIssue[];

  constructor(
    message: string,
    options?: {
      field?: string;
      code?: string;
      path?: string[];
      issues?: z.ZodIssue[];
    }
  ) {
    super(message);
    this.name = 'SchemaValidationError';
    this.field = options?.field;
    this.code = options?.code || 'VALIDATION_ERROR';
    this.path = options?.path;
    this.issues = options?.issues;
  }

  /**
   * Format error for API responses
   */
  toJSON() {
    return {
      error: this.name,
      message: this.message,
      code: this.code,
      field: this.field,
      path: this.path,
      details: this.issues?.map(issue => ({
        code: issue.code,
        path: issue.path,
        message: issue.message,
      })),
    };
  }
}

/**
 * Type-safe validation function for any entity
 */
export function validateEntity<T>(schema: z.ZodType<T>, data: unknown, entityName: string): T {
  try {
    return schema.parse(data);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      throw new SchemaValidationError(`Invalid ${entityName} data`, {
        code: `INVALID_${entityName.toUpperCase()}`,
        issues: error.errors,
        path: error.errors[0]?.path.map(String), // Ensure path elements are strings
        field: error.errors[0]?.path.map(String).join('.'), // Ensure path elements are strings before join
      });
    }
    throw error instanceof AppError
      ? error
      : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
  }
}

// Enhanced schemas with additional validation rules
// ------------------------------------------------

// User validation schema
// Use the up-to-date userRoleSchema from shared/db/users.ts
export const userSchema = createInsertSchema(schema.users, {
  username: zod => zod.min(3, 'Username must be at least 3 characters').max(50),
  email: zod => zod.email('Invalid email format'),
  password: zod => zod.min(8, 'Password must be at least 8 characters'),
  fullName: zod => zod.min(2, 'Full name must be at least 2 characters'),
  // role: do not override unless you want to restrict further; DB schema controls enum
});

export const userValidation = {
  insert: (data: unknown) => validateEntity(userSchema, data, 'user'),
  // Additional validation rules for specific operations
  update: (data: unknown) =>
    validateEntity(userSchema.partial().omit({ password: true }), data, 'user'),
  passwordReset: (data: unknown) =>
    validateEntity(
      z
        .object({
          password: z.string().min(8, 'Password must be at least 8 characters'),
          confirmPassword: z.string(),
        })
        .refine(data => data.password === data.confirmPassword, {
          message: 'Passwords do not match',
          path: ['confirmPassword'],
        }),
      data,
      'password_reset'
    ),
};

// Product validation schema
export const productSchema = createInsertSchema(schema.products, {
  name: zod => zod.min(2, 'Product name must be at least 2 characters'),
  price: zod =>
    zod.regex(/^\d+(\.\d{1,2})?$/, 'Price must be a valid decimal with up to 2 decimal places'),
  sku: zod => zod.min(3, 'SKU must be at least 3 characters'),
});

export const productValidation = {
  insert: (data: unknown) => validateEntity(productSchema, data, 'product'),
  update: (data: unknown) => validateEntity(productSchema.partial(), data, 'product'),
};

// Inventory validation schema
// schema.inventory (from shared/db/inventory.ts) now includes batchTracking.
// createInsertSchema(schema.inventory) will infer all fields, including batchTracking.
// We only need to .extend() for fields where we want to apply stricter or different Zod rules
// than what drizzle-zod infers from the DB schema.
export const inventorySchema = createInsertSchema(schema.inventory, {
  // Override with function if stricter rules needed, else let drizzle infer
  totalQuantity: zod => zod.int().min(0, 'Total quantity cannot be negative'),
  minimumLevel: zod => zod.int().min(0, 'Minimum level cannot be negative'),
  // batchTracking: do not override unless needed
});

// Inventory Item validation schema
export const inventoryItemSchema = z.object({
  inventoryId: z.number().int().positive(),
  productId: z.number().int().positive(),
  sku: z.string().min(3, 'SKU must be at least 3 characters'),
  quantity: z.number().int().min(0, 'Quantity cannot be negative'),
  reorderLevel: z.number().int().min(0, 'Reorder level cannot be negative').optional(),
  reorderQuantity: z.number().int().min(0, 'Reorder quantity cannot be negative').optional(),
  receivedDate: z.date().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  metadata: z.string().nullable().optional(),
});

export const inventoryValidation = {
  insert: (data: unknown) => validateEntity(inventorySchema, data, 'inventory'),
  update: (data: unknown) => validateEntity(inventorySchema.partial(), data, 'inventory'),
  // Add specific operation for inventory adjustments
  adjustment: (data: unknown) =>
    validateEntity(
      z.object({
        inventoryId: z.number().int().positive(),
        quantity: z.number().int(),
        reason: z.string().min(1, 'Reason is required'),
        userId: z.number().int().positive(),
      }),
      data,
      'inventory_adjustment'
    ),
  // Inventory Item validation
  itemInsert: (data: unknown) => validateEntity(inventoryItemSchema, data, 'inventory_item'),
  itemUpdate: (data: unknown) =>
    validateEntity(inventoryItemSchema.partial(), data, 'inventory_item'),
};

// Loyalty module validation
export const loyaltyProgramSchema = createInsertSchema(schema.loyaltyPrograms, {
  name: zod => zod.min(1, 'Program name is required'),
  description: zod => zod.optional(),
  status: zod => zod, // Let drizzle infer the enum; only override if you want further restriction
  // metadata: do not override unless needed
});

export const loyaltyMemberSchema = createInsertSchema(schema.loyaltyMembers, {
  loyaltyId: zod => zod.min(5, 'Loyalty ID must be at least 5 characters'),
  // points: do not override unless needed
});

export const loyaltyTransactionSchema = createInsertSchema(schema.loyaltyTransactions, {
  points: zod => zod, // Let drizzle infer
  type: zod => zod, // Let drizzle infer
  // Add other specific field validations if necessary
});

export const loyaltyValidation = {
  program: {
    insert: (data: unknown) => validateEntity(loyaltyProgramSchema, data, 'loyalty_program'),
    update: (data: unknown) =>
      validateEntity(loyaltyProgramSchema.partial(), data, 'loyalty_program'),
  },
  member: {
    insert: (data: unknown) => validateEntity(loyaltyMemberSchema, data, 'loyalty_member'),
    update: (data: unknown) =>
      validateEntity(loyaltyMemberSchema.partial(), data, 'loyalty_member'),
  },
  transaction: {
    insert: (data: unknown) =>
      validateEntity(loyaltyTransactionSchema, data, 'loyalty_transaction'),
    // update: (data: unknown) => validateEntity(loyaltyTransactionSchema.partial(), data, 'loyalty_transaction'), // If needed
  },
  earnPoints: (data: unknown) =>
    validateEntity(
      z.object({
        memberId: z.number().int().positive(),
        points: z.number().positive('Points must be a positive number'),
        transactionId: z.string().optional(),
        source: z.string(),
      }),
      data,
      'loyalty_transaction'
    ),
  redeemPoints: (data: unknown) =>
    validateEntity(
      z.object({
        memberId: z.number().int().positive(),
        points: z.number().positive('Points must be a positive number'),
        rewardId: z.number().int().positive(),
      }),
      data,
      'loyalty_redemption'
    ),
};

// Subscription validation
// We use a custom approach here to handle the field mismatches between code and database
const subscriptionBase = {
  userId: z.number().int().positive(),
  plan: z.enum(['basic', 'premium', 'pro', 'enterprise']),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Amount must be a valid decimal'),
  currency: z.string().min(3).max(3).default('NGN'),
  status: z
    .enum(['active', 'inactive', 'pending', 'cancelled', 'expired', 'past_due', 'trial', 'failed'])
    .default('active'),
  startDate: z.date().default(() => new Date()),
  endDate: z.date().min(new Date(), 'End date must be in the future'),
  autoRenew: z.boolean().default(true),
  paymentProvider: z.enum(['paystack', 'flutterwave', 'stripe', 'manual']).default('manual'),
  paymentReference: z.string().optional(),
  referralCode: z.string().optional(),
  discountApplied: z.boolean().default(false),
  discountAmount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Discount amount must be a valid decimal')
    .default('0'),
};

// Create a Zod schema that works with our code structure (camelCase)
export const subscriptionSchema = z.object(subscriptionBase);

export const subscriptionValidation = {
  insert: (data: unknown) => validateEntity(subscriptionSchema, data, 'subscription'),
  update: (data: unknown) => validateEntity(subscriptionSchema.partial(), data, 'subscription'),
  cancel: (data: unknown) =>
    validateEntity(
      z.object({
        subscriptionId: z.number().int().positive(),
        reason: z.string().optional(),
      }),
      data,
      'subscription_cancellation'
    ),
  webhook: (data: unknown) =>
    validateEntity(
      z.object({
        provider: z.enum(['paystack', 'flutterwave', 'stripe']),
        event: z.string(),
        data: z.any(),
        reference: z.string().optional(),
      }),
      data,
      'subscription_webhook'
    ),
};

// Transaction validation
export const transactionSchema = createInsertSchema(schema.transactions, {
  transactionId: zod => zod.min(5, 'Transaction ID must be at least 5 characters'),
  // Add other specific field validations if necessary
});

// Transaction item schema
export const transactionItemSchema = createInsertSchema(schema.transactionItems, {
  quantity: z.number().int().positive('Quantity must be positive'),
  unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Unit price must be a valid decimal'),
  // subtotal: z.string().regex(/^\d+(\.\d{1,2})?$/, "Subtotal must be a valid decimal"), // Let Drizzle infer
});

// Transaction payment schema
// This schema defines the expected structure for a "payment" object related to a transaction.
// It seems the system expects a 'total' field for payments, not 'totalAmount'.
export const transactionPaymentSchema = z.object({
  total: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Total must be a valid decimal number'),
  method: z.string().min(1, 'Payment method is required'),
  reference: z.string().optional(), // e.g., payment gateway reference
  status: z.enum(['pending', 'completed', 'failed', 'refunded']).optional(),
});

export const transactionValidation = {
  insert: (data: unknown) => validateEntity(transactionSchema, data, 'transaction'),
  update: (data: unknown) => validateEntity(transactionSchema.partial(), data, 'transaction'),
  item: {
    insert: (data: unknown) => validateEntity(transactionItemSchema, data, 'transaction_item'),
    update: (data: unknown) =>
      validateEntity(transactionItemSchema.partial(), data, 'transaction_item'),
  },
  payment: {
    insert: (data: unknown) =>
      validateEntity(transactionPaymentSchema, data, 'transaction_payment'),
    update: (data: unknown) =>
      validateEntity(transactionPaymentSchema.partial(), data, 'transaction_payment'),
  },
  refund: {
    insert: (data: unknown) => validateEntity(returnSchema, data, 'return'),
    update: (data: unknown) => validateEntity(returnSchema.partial(), data, 'return'),
  },
};

// Return/refund validation
export const returnSchema = createInsertSchema(schema.returns, {
  refundId: zod => zod.min(5, 'Refund ID must be at least 5 characters'),
  total: zod => zod.regex(/^\d+(\.\d{1,2})?$/, 'Total must be a valid decimal'),
  // Add other specific field validations if necessary
});

export const returnValidation = {
  insert: (data: unknown) => validateEntity(returnSchema, data, 'return'),
  update: (data: unknown) => validateEntity(returnSchema.partial(), data, 'return'),
  processItem: (data: unknown) =>
    validateEntity(
      z.object({
        returnId: z.number().int().positive(),
        productId: z.number().int().positive(),
        quantity: z.number().int().positive(),
        unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Unit price must be a valid decimal'),
        isRestocked: z.boolean().optional(),
      }),
      data,
      'return_item'
    ),
};
