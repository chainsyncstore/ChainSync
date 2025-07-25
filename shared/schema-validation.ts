/**
 * Schema Validation Utilities
 * 
 * This file provides centralized validation utilities for the application schema,
 * replacing ad-hoc type assertions with robust runtime validation.
 */

import { z } from 'zod';
import * as schema from './schema';
import { createInsertSchema } from 'drizzle-zod';

/**
 * Error class for schema validation failures
 */
export class SchemaValidationError extends Error {
  public readonly field?: string;
  public readonly code: string;
  public readonly path?: string[];
  public readonly issues?: z.ZodIssue[];

  constructor(message: string, options?: {
    field?: string;
    code?: string;
    path?: string[];
    issues?: z.ZodIssue[];
  }) {
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
        message: issue.message
      }))
    };
  }
}

/**
 * Type-safe validation function for any entity
 */
export function validateEntity<T>(schema: z.ZodType<T>, data: unknown, entityName: string): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new SchemaValidationError(
        `Invalid ${entityName} data`,
        {
          code: `INVALID_${entityName.toUpperCase()}`,
          issues: error.errors,
          path: error.errors[0]?.path as string[],
          field: error.errors[0]?.path.join('.')
        }
      );
    }
    throw error;
  }
}

// Enhanced schemas with additional validation rules
// ------------------------------------------------

// User validation schema
export const userSchema = createInsertSchema(schema.users).extend({
  username: z.string().min(3, "Username must be at least 3 characters").max(50),
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  role: z.enum(["admin", "manager", "cashier", "customer"]),
});

export const userValidation = {
  insert: userSchema,
  // Additional validation rules for specific operations
  update: userSchema.partial().omit({ password: true }),
  passwordReset: z.object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string()
  }).refine(data => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  }),
};

// Product validation schema
export const productSchema = createInsertSchema(schema.products).extend({
  name: z.string().min(2, "Product name must be at least 2 characters"),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, "Price must be a valid decimal with up to 2 decimal places"),
  sku: z.string().min(3, "SKU must be at least 3 characters"),
});

// Schema for inventory adjustment related to products
const inventoryAdjustmentSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int(),
  reason: z.string().min(2, "Reason must be at least 2 characters"),
});

// Webhook validation schemas
export const webhookValidation = {
  create: (data: unknown) => validateEntity(
    z.object({
      url: z.string().url(),
      storeId: z.number().int().positive(),
      events: z.array(z.string()).min(1),
    }),
    data,
    'webhook'
  ),
  update: (data: unknown) => validateEntity(
    z.object({
      url: z.string().url().optional(),
      events: z.array(z.string()).optional(),
      isActive: z.boolean().optional(),
    }),
    data,
    'webhook'
  ),
};

export const productValidation = {
  insert: productSchema,
  update: productSchema.partial(),
  inventory: {
    adjustment: inventoryAdjustmentSchema,
  },
};

// Inventory validation schema
export const inventorySchema = createInsertSchema(schema.inventory).extend({
  totalQuantity: z.number().int().min(0, "Quantity cannot be negative"),
  minimumLevel: z.number().int().min(0, "Minimum level cannot be negative"),
});

// Inventory Item validation schema
export const inventoryItemSchema = z.object({
  inventoryId: z.number().int().positive(),
  productId: z.number().int().positive(),
  sku: z.string().min(3, "SKU must be at least 3 characters"),
  quantity: z.number().int().min(0, "Quantity cannot be negative"),
  reorderLevel: z.number().int().min(0, "Reorder level cannot be negative").optional(),
  reorderQuantity: z.number().int().min(0, "Reorder quantity cannot be negative").optional(),
  receivedDate: z.date().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  metadata: z.string().nullable().optional(),
});

export const inventoryValidation = {
  insert: inventorySchema,
  update: inventorySchema.partial(),
  // Add specific operation for inventory adjustments
  adjustment: z.object({
    inventoryId: z.number().int().positive(),
    quantity: z.number().int(),
    reason: z.string().min(1, "Reason is required"),
    userId: z.number().int().positive()
  }),
  // Inventory Item validation
  itemInsert: inventoryItemSchema,
  itemUpdate: inventoryItemSchema.partial(),
  transactionInsert: z.object({
    inventoryId: z.number().int().positive(),
    itemId: z.number().int().positive(),
    quantity: z.number().int(),
    type: z.enum(['in', 'out']),
  }),
};

// Loyalty module validation
export const loyaltyMemberSchema = createInsertSchema(schema.loyaltyMembers).extend({
  loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
  currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});

// Create schema for loyalty transactions and programs
export const loyaltyProgramInsertSchema = createInsertSchema(schema.loyaltyPrograms);
export const loyaltyProgramSchema = loyaltyProgramInsertSchema;
export const loyaltyTransactionSchema = createInsertSchema(schema.loyaltyTransactions).extend({
  description: z.string().optional(),
});

export const loyaltyValidation = {
  member: {
    schema: loyaltyMemberSchema,
    insert: loyaltyMemberSchema,
    update: loyaltyMemberSchema.partial(),
  },
  earnPoints: z.object({
    memberId: z.number().int().positive(),
    points: z.number().positive("Points must be a positive number"),
    transactionId: z.string().optional(),
    source: z.string()
  }),
  redeemPoints: z.object({
    memberId: z.number().int().positive(),
    points: z.number().positive("Points must be a positive number"),
    rewardId: z.number().int().positive(),
  }),
  programInsert: loyaltyProgramSchema,
  programUpdate: loyaltyProgramSchema.partial(),
  transactionInsert: loyaltyTransactionSchema,
};

// Subscription validation
// We use a custom approach here to handle the field mismatches between code and database
const subscriptionBase = {
  userId: z.number().int().positive(),
  plan: z.enum(["basic", "premium", "pro", "enterprise"]),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Amount must be a valid decimal"),
  currency: z.string().min(3).max(3).default("NGN"),
  status: z.enum(["active", "inactive", "pending", "cancelled", "expired", "past_due", "trial", "failed"]).default("active"),
  startDate: z.date().default(() => new Date()),
  endDate: z.date().min(new Date(), "End date must be in the future"),
  autoRenew: z.boolean().default(true),
  paymentProvider: z.enum(["paystack", "flutterwave", "stripe", "manual"]).default("manual"),
  paymentReference: z.string().optional(),
  referralCode: z.string().optional(),
  discountApplied: z.boolean().default(false),
  discountAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Discount amount must be a valid decimal").default("0")
};

// Create a Zod schema that works with our code structure (camelCase)
export const subscriptionSchema = z.object(subscriptionBase);

export const subscriptionValidation = {
  insert: subscriptionSchema,
  update: subscriptionSchema.partial(),
  cancel: z.object({
    subscriptionId: z.number().int().positive(),
    reason: z.string().optional(),
  }),
  webhook: z.object({
    provider: z.enum(["paystack", "flutterwave", "stripe"]),
    event: z.string(),
    data: z.any(),
    reference: z.string().optional(),
  }),
};

// Transaction validation
export const transactionSchema = createInsertSchema(schema.transactions).extend({
  total: z.string().regex(/^\d+(\.\d{1,2})?$/, "Total amount must be a valid decimal"),
  paymentMethod: z.string().min(1, "Payment method is required"),
  status: z.string().min(1, "Status is required"),
});

// Transaction item schema
export const transactionItemSchema = createInsertSchema(schema.transactionItems).extend({
  quantity: z.number().int().positive("Quantity must be positive"),
  unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, "Unit price must be a valid decimal"),
});

// Transaction payment schema
export const transactionPaymentSchema = createInsertSchema(schema.transactionPayments).extend({
      amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Amount must be a valid decimal"),
      method: z.string().min(1, "Payment method is required") as any,
    });

export const returnSchema = createInsertSchema(schema.returns).extend({
  refundId: z.string().min(5, "Refund ID must be at least 5 characters"),
  total: z.string().regex(/^\d+(\.\d{1,2})?$/, "Total must be a valid decimal"),
  refundMethod: z.enum(["cash", "credit_card", "store_credit"]),
});

export const transactionValidation = {
  insert: transactionSchema,
  update: transactionSchema.partial(),
  item: {
    insert: transactionItemSchema,
    update: transactionItemSchema.partial(),
  },
  payment: {
    insert: transactionPaymentSchema,
    update: transactionPaymentSchema.partial(),
  },
  refund: {
    insert: returnSchema,
    update: returnSchema.partial(),
  },
};

// Return/refund validation
export const returnValidation = {
  insert: returnSchema,
  update: returnSchema.partial(),
  processItem: z.object({
    returnId: z.number().int().positive(),
    productId: z.number().int().positive(),
    quantity: z.number().int().positive(),
    unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, "Unit price must be a valid decimal"),
    isRestocked: z.boolean().optional(),
  }),
};
