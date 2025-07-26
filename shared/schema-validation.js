"use strict";
/**
 * Schema Validation Utilities
 *
 * This file provides centralized validation utilities for the application schema,
 * replacing ad-hoc type assertions with robust runtime validation.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.returnValidation = exports.transactionValidation = exports.returnSchema = exports.transactionPaymentSchema = exports.transactionItemSchema = exports.transactionSchema = exports.subscriptionValidation = exports.subscriptionSchema = exports.loyaltyValidation = exports.loyaltyTransactionSchema = exports.loyaltyProgramSchema = exports.loyaltyProgramInsertSchema = exports.loyaltyMemberSchema = exports.inventoryValidation = exports.inventoryItemSchema = exports.inventorySchema = exports.productValidation = exports.webhookValidation = exports.productSchema = exports.userValidation = exports.userSchema = exports.SchemaValidationError = void 0;
exports.validateEntity = validateEntity;
const zod_1 = require("zod");
const schema = __importStar(require("./schema"));
const drizzle_zod_1 = require("drizzle-zod");
/**
 * Error class for schema validation failures
 */
class SchemaValidationError extends Error {
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
exports.SchemaValidationError = SchemaValidationError;
/**
 * Type-safe validation function for any entity
 */
function validateEntity(schema, data, entityName) {
    try {
        return schema.parse(data);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            throw new SchemaValidationError(`Invalid ${entityName} data`, {
                code: `INVALID_${entityName.toUpperCase()}`,
                issues: error.errors,
                path: error.errors[0]?.path,
                field: error.errors[0]?.path.join('.')
            });
        }
        throw error;
    }
}
// Enhanced schemas with additional validation rules
// ------------------------------------------------
// User validation schema
exports.userSchema = (0, drizzle_zod_1.createInsertSchema)(schema.users).extend({
    username: zod_1.z.string().min(3, "Username must be at least 3 characters").max(50),
    email: zod_1.z.string().email("Invalid email format"),
    password: zod_1.z.string().min(8, "Password must be at least 8 characters"),
    fullName: zod_1.z.string().min(2, "Full name must be at least 2 characters"),
    role: zod_1.z.enum(["admin", "manager", "cashier", "customer"]),
});
exports.userValidation = {
    insert: exports.userSchema,
    // Additional validation rules for specific operations
    update: exports.userSchema.partial().omit({ password: true }),
    passwordReset: zod_1.z.object({
        password: zod_1.z.string().min(8, "Password must be at least 8 characters"),
        confirmPassword: zod_1.z.string()
    }).refine(data => data.password === data.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"]
    }),
};
// Product validation schema
exports.productSchema = (0, drizzle_zod_1.createInsertSchema)(schema.products).extend({
    name: zod_1.z.string().min(2, "Product name must be at least 2 characters"),
    price: zod_1.z.string().regex(/^\d+(\.\d{1,2})?$/, "Price must be a valid decimal with up to 2 decimal places"),
    sku: zod_1.z.string().min(3, "SKU must be at least 3 characters"),
});
// Schema for inventory adjustment related to products
const inventoryAdjustmentSchema = zod_1.z.object({
    productId: zod_1.z.number().int().positive(),
    quantity: zod_1.z.number().int(),
    reason: zod_1.z.string().min(2, "Reason must be at least 2 characters"),
});
// Webhook validation schemas
exports.webhookValidation = {
    create: (data) => validateEntity(zod_1.z.object({
        url: zod_1.z.string().url(),
        storeId: zod_1.z.number().int().positive(),
        events: zod_1.z.array(zod_1.z.string()).min(1),
    }), data, 'webhook'),
    update: (data) => validateEntity(zod_1.z.object({
        url: zod_1.z.string().url().optional(),
        events: zod_1.z.array(zod_1.z.string()).optional(),
        isActive: zod_1.z.boolean().optional(),
    }), data, 'webhook'),
};
exports.productValidation = {
    insert: exports.productSchema,
    update: exports.productSchema.partial(),
    inventory: {
        adjustment: inventoryAdjustmentSchema,
    },
};
// Inventory validation schema
exports.inventorySchema = (0, drizzle_zod_1.createInsertSchema)(schema.inventory).extend({
    totalQuantity: zod_1.z.number().int().min(0, "Quantity cannot be negative"),
    minimumLevel: zod_1.z.number().int().min(0, "Minimum level cannot be negative"),
});
// Inventory Item validation schema
exports.inventoryItemSchema = zod_1.z.object({
    inventoryId: zod_1.z.number().int().positive(),
    productId: zod_1.z.number().int().positive(),
    sku: zod_1.z.string().min(3, "SKU must be at least 3 characters"),
    quantity: zod_1.z.number().int().min(0, "Quantity cannot be negative"),
    reorderLevel: zod_1.z.number().int().min(0, "Reorder level cannot be negative").optional(),
    reorderQuantity: zod_1.z.number().int().min(0, "Reorder quantity cannot be negative").optional(),
    receivedDate: zod_1.z.date().optional(),
    createdAt: zod_1.z.date().optional(),
    updatedAt: zod_1.z.date().optional(),
    metadata: zod_1.z.string().nullable().optional(),
});
exports.inventoryValidation = {
    insert: exports.inventorySchema,
    update: exports.inventorySchema.partial(),
    // Add specific operation for inventory adjustments
    adjustment: zod_1.z.object({
        inventoryId: zod_1.z.number().int().positive(),
        quantity: zod_1.z.number().int(),
        reason: zod_1.z.string().min(1, "Reason is required"),
        userId: zod_1.z.number().int().positive()
    }),
    // Inventory Item validation
    itemInsert: exports.inventoryItemSchema,
    itemUpdate: exports.inventoryItemSchema.partial(),
    transactionInsert: zod_1.z.object({
        inventoryId: zod_1.z.number().int().positive(),
        itemId: zod_1.z.number().int().positive(),
        quantity: zod_1.z.number().int(),
        type: zod_1.z.enum(['in', 'out']),
    }),
};
// Loyalty module validation
exports.loyaltyMemberSchema = (0, drizzle_zod_1.createInsertSchema)(schema.loyaltyMembers).extend({
    loyaltyId: zod_1.z.string().min(5, "Loyalty ID must be at least 5 characters"),
    currentPoints: zod_1.z.string().regex(/^\d+(\.\d{1,2})?$/, "Points must be a valid decimal"),
});
// Create schema for loyalty transactions and programs
exports.loyaltyProgramInsertSchema = (0, drizzle_zod_1.createInsertSchema)(schema.loyaltyPrograms);
exports.loyaltyProgramSchema = exports.loyaltyProgramInsertSchema;
exports.loyaltyTransactionSchema = (0, drizzle_zod_1.createInsertSchema)(schema.loyaltyTransactions).extend({
    description: zod_1.z.string().optional(),
});
exports.loyaltyValidation = {
    member: {
        schema: exports.loyaltyMemberSchema,
        insert: exports.loyaltyMemberSchema,
        update: exports.loyaltyMemberSchema.partial(),
    },
    earnPoints: zod_1.z.object({
        memberId: zod_1.z.number().int().positive(),
        points: zod_1.z.number().positive("Points must be a positive number"),
        transactionId: zod_1.z.string().optional(),
        source: zod_1.z.string()
    }),
    redeemPoints: zod_1.z.object({
        memberId: zod_1.z.number().int().positive(),
        points: zod_1.z.number().positive("Points must be a positive number"),
        rewardId: zod_1.z.number().int().positive(),
    }),
    programInsert: exports.loyaltyProgramSchema,
    programUpdate: exports.loyaltyProgramSchema.partial(),
    transactionInsert: exports.loyaltyTransactionSchema,
};
// Subscription validation
// We use a custom approach here to handle the field mismatches between code and database
const subscriptionBase = {
    userId: zod_1.z.number().int().positive(),
    plan: zod_1.z.enum(["basic", "premium", "pro", "enterprise"]),
    amount: zod_1.z.string().regex(/^\d+(\.\d{1,2})?$/, "Amount must be a valid decimal"),
    currency: zod_1.z.string().min(3).max(3).default("NGN"),
    status: zod_1.z.enum(["active", "inactive", "pending", "cancelled", "expired", "past_due", "trial", "failed"]).default("active"),
    startDate: zod_1.z.date().default(() => new Date()),
    endDate: zod_1.z.date().min(new Date(), "End date must be in the future"),
    autoRenew: zod_1.z.boolean().default(true),
    paymentProvider: zod_1.z.enum(["paystack", "flutterwave", "stripe", "manual"]).default("manual"),
    paymentReference: zod_1.z.string().optional(),
    referralCode: zod_1.z.string().optional(),
    discountApplied: zod_1.z.boolean().default(false),
    discountAmount: zod_1.z.string().regex(/^\d+(\.\d{1,2})?$/, "Discount amount must be a valid decimal").default("0")
};
// Create a Zod schema that works with our code structure (camelCase)
exports.subscriptionSchema = zod_1.z.object(subscriptionBase);
exports.subscriptionValidation = {
    insert: exports.subscriptionSchema,
    update: exports.subscriptionSchema.partial(),
    cancel: zod_1.z.object({
        subscriptionId: zod_1.z.number().int().positive(),
        reason: zod_1.z.string().optional(),
    }),
    webhook: zod_1.z.object({
        provider: zod_1.z.enum(["paystack", "flutterwave", "stripe"]),
        event: zod_1.z.string(),
        data: zod_1.z.any(),
        reference: zod_1.z.string().optional(),
    }),
};
// Transaction validation
exports.transactionSchema = (0, drizzle_zod_1.createInsertSchema)(schema.transactions).extend({
    total: zod_1.z.string().regex(/^\d+(\.\d{1,2})?$/, "Total amount must be a valid decimal"),
    paymentMethod: zod_1.z.string().min(1, "Payment method is required"),
    status: zod_1.z.string().min(1, "Status is required"),
});
// Transaction item schema
exports.transactionItemSchema = (0, drizzle_zod_1.createInsertSchema)(schema.transactionItems).extend({
    quantity: zod_1.z.number().int().positive("Quantity must be positive"),
    unitPrice: zod_1.z.string().regex(/^\d+(\.\d{1,2})?$/, "Unit price must be a valid decimal"),
});
// Transaction payment schema
exports.transactionPaymentSchema = (0, drizzle_zod_1.createInsertSchema)(schema.transactionPayments).extend({
    amount: zod_1.z.string().regex(/^\d+(\.\d{1,2})?$/, "Amount must be a valid decimal"),
    method: zod_1.z.string().min(1, "Payment method is required"),
});
exports.returnSchema = (0, drizzle_zod_1.createInsertSchema)(schema.returns).extend({
    refundId: zod_1.z.string().min(5, "Refund ID must be at least 5 characters"),
    total: zod_1.z.string().regex(/^\d+(\.\d{1,2})?$/, "Total must be a valid decimal"),
    refundMethod: zod_1.z.enum(["cash", "credit_card", "store_credit"]),
});
exports.transactionValidation = {
    insert: exports.transactionSchema,
    update: exports.transactionSchema.partial(),
    item: {
        insert: exports.transactionItemSchema,
        update: exports.transactionItemSchema.partial(),
    },
    payment: {
        insert: exports.transactionPaymentSchema,
        update: exports.transactionPaymentSchema.partial(),
    },
    refund: {
        insert: exports.returnSchema,
        update: exports.returnSchema.partial(),
    },
};
// Return/refund validation
exports.returnValidation = {
    insert: exports.returnSchema,
    update: exports.returnSchema.partial(),
    processItem: zod_1.z.object({
        returnId: zod_1.z.number().int().positive(),
        productId: zod_1.z.number().int().positive(),
        quantity: zod_1.z.number().int().positive(),
        unitPrice: zod_1.z.string().regex(/^\d+(\.\d{1,2})?$/, "Unit price must be a valid decimal"),
        isRestocked: zod_1.z.boolean().optional(),
    }),
};
