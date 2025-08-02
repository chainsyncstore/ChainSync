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
  public readonly _code: string;
  public readonly path?: string[];
  public readonly issues?: z.ZodIssue[];

  constructor(_message: string, options?: {
    field?: string;
    code?: string;
    path?: string[];
    issues?: z.ZodIssue[];
  }) {
    super(message);
    this.name = 'SchemaValidationError';
    if (options?.field !== undefined) this.field = options.field;
    this.code = options?.code || 'VALIDATION_ERROR';
    if (options?.path !== undefined) this.path = options.path;
    if (options?.issues !== undefined) this.issues = options.issues;
  }

  /**
   * Format error for API responses
   */
  toJSON() {
    return {
      _error: this.name,
      _message: this.message,
      _code: this.code,
      _field: this.field,
      _path: this.path,
      _details: this.issues?.map(issue => ({
        _code: issue.code,
        _path: issue.path,
        _message: issue.message
      }))
    };
  }
}

/**
 * Type-safe validation function for any entity
 */
export function validateEntity<T>(_schema: z.ZodType<T>, _data: unknown, _entityName: string): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues || [];
      throw new SchemaValidationError(
        `Invalid ${entityName} data`,
        {
          _code: `INVALID_${entityName.toUpperCase()}`,
          _issues: issues,
          _path: issues[0]?.path as string[],
          _field: issues[0]?.path?.join('.') || ''
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
  _username: z.string().min(3, 'Username must be at least 3 characters').max(50),
  _email: z.string().email('Invalid email format'),
  _password: z.string().min(8, 'Password must be at least 8 characters'),
  _fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  _role: z.enum(['admin', 'manager', 'cashier', 'customer'])
});

export const userValidation = {
  _insert: userSchema,
  // Additional validation rules for specific operations
  _update: userSchema.partial().omit({ _password: true }),
  _passwordReset: z.object({
    _password: z.string().min(8, 'Password must be at least 8 characters'),
    _confirmPassword: z.string()
  }).refine(data => data.password === data.confirmPassword, {
    _message: 'Passwords do not match',
    _path: ['confirmPassword']
  })
};

// Product validation schema
export const productSchema = createInsertSchema(schema.products).extend({
  _name: z.string().min(2, 'Product name must be at least 2 characters'),
  _price: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Price must be a valid decimal with up to 2 decimal places'),
  _sku: z.string().min(3, 'SKU must be at least 3 characters')
});

// Schema for inventory adjustment related to products
const inventoryAdjustmentSchema = z.object({
  _productId: z.number().int().positive(),
  _quantity: z.number().int(),
  _reason: z.string().min(2, 'Reason must be at least 2 characters')
});

// Webhook validation schemas
export const webhookValidation = {
  _create: (_data: unknown) => validateEntity(
    z.object({
      _url: z.string().url(),
      _storeId: z.number().int().positive(),
      _events: z.array(z.string()).min(1)
    }),
    data,
    'webhook'
  ),
  _update: (_data: unknown) => validateEntity(
    z.object({
      _url: z.string().url().optional(),
      _events: z.array(z.string()).optional(),
      _isActive: z.boolean().optional()
    }),
    data,
    'webhook'
  )
};

export const productValidation = {
  _insert: productSchema,
  _update: productSchema.partial(),
  _inventory: {
    _adjustment: inventoryAdjustmentSchema
  }
};

// Inventory validation schema
export const inventorySchema = createInsertSchema(schema.inventory).extend({
  _totalQuantity: z.number().int().min(0, 'Quantity cannot be negative'),
  _minimumLevel: z.number().int().min(0, 'Minimum level cannot be negative')
});

// Inventory Item validation schema
export const inventoryItemSchema = z.object({
  _inventoryId: z.number().int().positive(),
  _productId: z.number().int().positive(),
  _sku: z.string().min(3, 'SKU must be at least 3 characters'),
  _quantity: z.number().int().min(0, 'Quantity cannot be negative'),
  _reorderLevel: z.number().int().min(0, 'Reorder level cannot be negative').optional(),
  _reorderQuantity: z.number().int().min(0, 'Reorder quantity cannot be negative').optional(),
  _receivedDate: z.date().optional(),
  _createdAt: z.date().optional(),
  _updatedAt: z.date().optional(),
  _metadata: z.string().nullable().optional()
});

export const inventoryValidation = {
  _insert: inventorySchema,
  _update: inventorySchema.partial(),
  // Add specific operation for inventory adjustments
  _adjustment: z.object({
    _inventoryId: z.number().int().positive(),
    _quantity: z.number().int(),
    _reason: z.string().min(1, 'Reason is required'),
    _userId: z.number().int().positive()
  }),
  // Inventory Item validation
  _itemInsert: inventoryItemSchema,
  _itemUpdate: inventoryItemSchema.partial(),
  _transactionInsert: z.object({
    _inventoryId: z.number().int().positive(),
    _itemId: z.number().int().positive(),
    _quantity: z.number().int(),
    _type: z.enum(['in', 'out'])
  })
};

// Loyalty module validation
export const loyaltyMemberSchema = createInsertSchema(schema.loyaltyMembers).extend({
  _loyaltyId: z.string().min(5, 'Loyalty ID must be at least 5 characters'),
  _currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Points must be a valid decimal')
});

// Create schema for loyalty transactions and programs
export const loyaltyProgramInsertSchema = createInsertSchema(schema.loyaltyPrograms);
export const loyaltyProgramSchema = loyaltyProgramInsertSchema;
export const loyaltyTransactionSchema = createInsertSchema(schema.loyaltyTransactions).extend({
  _description: z.string().optional()
});

export const loyaltyValidation = {
  _member: {
    _schema: loyaltyMemberSchema,
    _insert: loyaltyMemberSchema,
    _update: loyaltyMemberSchema.partial()
  },
  _earnPoints: z.object({
    _memberId: z.number().int().positive(),
    _points: z.number().positive('Points must be a positive number'),
    _transactionId: z.string().optional(),
    _source: z.string()
  }),
  _redeemPoints: z.object({
    _memberId: z.number().int().positive(),
    _points: z.number().positive('Points must be a positive number'),
    _rewardId: z.number().int().positive()
  }),
  _programInsert: loyaltyProgramSchema,
  _programUpdate: loyaltyProgramSchema.partial(),
  _transactionInsert: loyaltyTransactionSchema
};

// Subscription validation
// We use a custom approach here to handle the field mismatches between code and database
const subscriptionBase = {
  _userId: z.number().int().positive(),
  _plan: z.enum(['basic', 'premium', 'pro', 'enterprise']),
  _amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Amount must be a valid decimal'),
  _currency: z.string().min(3).max(3).default('NGN'),
  _status: z.enum(['active', 'inactive', 'pending', 'cancelled', 'expired', 'past_due', 'trial', 'failed']).default('active'),
  _startDate: z.date().default(() => new Date()),
  _endDate: z.date().min(new Date(), 'End date must be in the future'),
  _autoRenew: z.boolean().default(true),
  _paymentProvider: z.enum(['paystack', 'flutterwave', 'stripe', 'manual']).default('manual'),
  _paymentReference: z.string().optional(),
  _referralCode: z.string().optional(),
  _discountApplied: z.boolean().default(false),
  _discountAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Discount amount must be a valid decimal').default('0')
};

// Create a Zod schema that works with our code structure (camelCase)
export const subscriptionSchema = z.object(subscriptionBase);

export const subscriptionValidation = {
  _insert: subscriptionSchema,
  _update: subscriptionSchema.partial(),
  _cancel: z.object({
    _subscriptionId: z.number().int().positive(),
    _reason: z.string().optional()
  }),
  _webhook: z.object({
    _provider: z.enum(['paystack', 'flutterwave', 'stripe']),
    _event: z.string(),
    _data: z.any(),
    _reference: z.string().optional()
  })
};

// Transaction validation
export const transactionSchema = createInsertSchema(schema.transactions).extend({
  _total: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Total amount must be a valid decimal'),
  _paymentMethod: z.string().min(1, 'Payment method is required'),
  _status: z.string().min(1, 'Status is required')
});

// Transaction item schema
export const transactionItemSchema = createInsertSchema(schema.transactionItems).extend({
  _quantity: z.number().int().positive('Quantity must be positive'),
  _unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Unit price must be a valid decimal')
});

// Transaction payment schema
export const transactionPaymentSchema = createInsertSchema(schema.transactionPayments).extend({
      _amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Amount must be a valid decimal'),
      _method: z.string().min(1, 'Payment method is required') as any
    });

export const returnSchema = createInsertSchema(schema.returns).extend({
  _refundId: z.string().min(5, 'Refund ID must be at least 5 characters'),
  _total: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Total must be a valid decimal'),
  _refundMethod: z.enum(['cash', 'credit_card', 'store_credit'])
});

export const transactionValidation = {
  _insert: transactionSchema,
  _update: transactionSchema.partial(),
  _item: {
    _insert: transactionItemSchema,
    _update: transactionItemSchema.partial()
  },
  _payment: {
    _insert: transactionPaymentSchema,
    _update: transactionPaymentSchema.partial()
  },
  _refund: {
    _insert: returnSchema,
    _update: returnSchema.partial()
  }
};

// Return/refund validation
export const returnValidation = {
  _insert: returnSchema,
  _update: returnSchema.partial(),
  _processItem: z.object({
    _returnId: z.number().int().positive(),
    _productId: z.number().int().positive(),
    _quantity: z.number().int().positive(),
    _unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Unit price must be a valid decimal'),
    _isRestocked: z.boolean().optional()
  })
};
