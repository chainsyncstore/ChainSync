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
    constructor(message, options) {
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
export function validateEntity(schema, data, entityName) {
    try {
        return schema.parse(data);
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            throw new SchemaValidationError(`Invalid ${entityName} data`, {
                code: `INVALID_${entityName.toUpperCase()}`,
                issues: error.errors,
                path: error.errors[0]?.path.map(String), // Convert (string | number)[] to string[]
                field: error.errors[0]?.path.join('.')
            });
        }
        throw error;
    }
}
// Enhanced schemas with additional validation rules
// ------------------------------------------------
// User validation schema
export const userSchema = createInsertSchema(schema.users, {
    username: z.string().min(3, "Username must be at least 3 characters").max(50),
    email: z.string().email("Invalid email format"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    fullName: z.string().min(2, "Full name must be at least 2 characters"),
    role: z.enum(["admin", "manager", "cashier", "customer"]),
});
export const userValidation = {
    insert: (data) => validateEntity(userSchema, data, 'user'),
    // Additional validation rules for specific operations
    update: (data) => validateEntity(userSchema.partial().omit({ password: true }), data, 'user'),
    passwordReset: (data) => validateEntity(z.object({
        password: z.string().min(8, "Password must be at least 8 characters"),
        confirmPassword: z.string()
    }).refine(data => data.password === data.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"]
    }), data, 'password_reset')
};
// Product validation schema
export const productSchema = createInsertSchema(schema.products, {
    name: z.string().min(2, "Product name must be at least 2 characters"),
    price: z.string().regex(/^\d+(\.\d{1,2})?$/, "Price must be a valid decimal with up to 2 decimal places"),
    sku: z.string().min(3, "SKU must be at least 3 characters"),
});
export const productValidation = {
    insert: (data) => validateEntity(productSchema, data, 'product'),
    update: (data) => validateEntity(productSchema.partial(), data, 'product'),
};
// Inventory validation schema
export const inventorySchema = createInsertSchema(schema.inventory, {
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
    insert: (data) => validateEntity(inventorySchema, data, 'inventory'),
    update: (data) => validateEntity(inventorySchema.partial(), data, 'inventory'),
    // Add specific operation for inventory adjustments
    adjustment: (data) => validateEntity(z.object({
        inventoryId: z.number().int().positive(),
        quantity: z.number().int(),
        reason: z.string().min(1, "Reason is required"),
        userId: z.number().int().positive()
    }), data, 'inventory_adjustment'),
    // Inventory Item validation
    itemInsert: (data) => validateEntity(inventoryItemSchema, data, 'inventory_item'),
    itemUpdate: (data) => validateEntity(inventoryItemSchema.partial(), data, 'inventory_item'),
};
// Loyalty module validation
export const loyaltyMemberSchema = createInsertSchema(schema.loyaltyMembers, {
    loyaltyId: z.string().min(5, "Loyalty ID must be at least 5 characters"),
    currentPoints: z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});
export const loyaltyValidation = {
    member: {
        insert: (data) => validateEntity(loyaltyMemberSchema, data, 'loyalty_member'),
        update: (data) => validateEntity(loyaltyMemberSchema.partial(), data, 'loyalty_member'),
    },
    earnPoints: (data) => validateEntity(z.object({
        memberId: z.number().int().positive(),
        points: z.number().positive("Points must be a positive number"),
        transactionId: z.string().optional(),
        source: z.string()
    }), data, 'loyalty_transaction'),
    redeemPoints: (data) => validateEntity(z.object({
        memberId: z.number().int().positive(),
        points: z.number().positive("Points must be a positive number"),
        rewardId: z.number().int().positive(),
    }), data, 'loyalty_redemption')
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
    insert: (data) => validateEntity(subscriptionSchema, data, 'subscription'),
    update: (data) => validateEntity(subscriptionSchema.partial(), data, 'subscription'),
    cancel: (data) => validateEntity(z.object({
        subscriptionId: z.number().int().positive(),
        reason: z.string().optional(),
    }), data, 'subscription_cancellation'),
    webhook: (data) => validateEntity(z.object({
        provider: z.enum(["paystack", "flutterwave", "stripe"]),
        event: z.string(),
        data: z.any(),
        reference: z.string().optional(),
    }), data, 'subscription_webhook')
};
// Transaction validation
export const transactionSchema = createInsertSchema(schema.transactions, {
    transactionId: z.string().min(5, "Transaction ID must be at least 5 characters"),
    subtotal: z.coerce.number().nonnegative({ message: "Subtotal must be a non-negative number" }),
    paymentMethod: z.string().min(1, "Payment method is required"),
    type: z.enum(["SALE", "RETURN"]),
});
// Transaction item schema
export const transactionItemSchema = createInsertSchema(schema.transactionItems, {
    quantity: z.number().int().positive("Quantity must be positive"),
    unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, "Unit price must be a valid decimal"),
    subtotal: z.string().regex(/^\d+(\.\d{1,2})?$/, "Subtotal must be a valid decimal"),
});
// Transaction payment schema
export const transactionPaymentSchema = schema.transactionPayments // Changed from schema.payments
    ? createInsertSchema(schema.transactionPayments, {
        amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Amount must be a valid decimal"),
        method: z.string().min(1, "Payment method is required"),
    })
    : z.object({ amount: z.string(), method: z.string() }); // Fallback if transactionPayments is not found
export const transactionValidation = {
    insert: (data) => validateEntity(transactionSchema, data, 'transaction'),
    update: (data) => validateEntity(transactionSchema.partial(), data, 'transaction'),
    item: {
        insert: (data) => validateEntity(transactionItemSchema, data, 'transaction_item'),
        update: (data) => validateEntity(transactionItemSchema.partial(), data, 'transaction_item'),
    },
    payment: {
        insert: (data) => validateEntity(transactionPaymentSchema, data, 'transaction_payment'),
        update: (data) => validateEntity(transactionPaymentSchema.partial(), data, 'transaction_payment'),
    },
    refund: {
        insert: (data) => validateEntity(returnSchema, data, 'return'),
        update: (data) => validateEntity(returnSchema.partial(), data, 'return'),
    },
};
// Return/refund validation
export const returnSchema = createInsertSchema(schema.returns, {
    refundId: z.string().min(5, "Refund ID must be at least 5 characters"),
    total: z.string().regex(/^\d+(\.\d{1,2})?$/, "Total must be a valid decimal"),
    refundMethod: z.enum(["cash", "credit_card", "store_credit"]),
});
export const returnValidation = {
    insert: (data) => validateEntity(returnSchema, data, 'return'),
    update: (data) => validateEntity(returnSchema.partial(), data, 'return'),
    processItem: (data) => validateEntity(z.object({
        returnId: z.number().int().positive(),
        productId: z.number().int().positive(),
        quantity: z.number().int().positive(),
        unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, "Unit price must be a valid decimal"),
        isRestocked: z.boolean().optional(),
    }), data, 'return_item')
};
//# sourceMappingURL=schema-validation.js.map