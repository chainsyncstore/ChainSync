"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validationErrors = exports.schemas = exports.customerSchema = exports.orderSchema = exports.productSchema = exports.baseSchema = void 0;
const zod_1 = require("zod");
// Base schema for all import/export data
exports.baseSchema = zod_1.z.object({
    id: zod_1.z.number().int(),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
    status: zod_1.z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']),
});
// Product-specific validation schema
exports.productSchema = exports.baseSchema.extend({
    name: zod_1.z.string().min(1, 'Product name is required').max(255),
    description: zod_1.z.string().optional(),
    price: zod_1.z.number().min(0, 'Price must be non-negative'),
    quantity: zod_1.z.number().int().min(0, 'Quantity must be non-negative'),
    sku: zod_1.z.string().min(1, 'SKU is required').max(50),
    category: zod_1.z.string().optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
    images: zod_1.z.array(zod_1.z.string().url()).optional(),
    status: zod_1.z.enum(['ACTIVE', 'INACTIVE']),
});
// Order-specific validation schema
exports.orderSchema = exports.baseSchema.extend({
    userId: zod_1.z.number(),
    items: zod_1.z.array(zod_1.z.object({
        productId: zod_1.z.number(),
        quantity: zod_1.z.number().min(1),
    })),
    status: zod_1.z.enum(['PENDING', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
    shippingAddress: zod_1.z.object({
        street: zod_1.z.string().min(1),
        city: zod_1.z.string().min(1),
        state: zod_1.z.string().min(1),
        postalCode: zod_1.z.string().min(1),
        country: zod_1.z.string().min(1),
    }),
});
// Customer-specific validation schema
exports.customerSchema = exports.baseSchema.extend({
    firstName: zod_1.z.string().min(1, 'First name is required').max(50),
    lastName: zod_1.z.string().min(1, 'Last name is required').max(50),
    email: zod_1.z.string().email('Invalid email address'),
    phone: zod_1.z.string().optional(),
    address: zod_1.z.object({
        street: zod_1.z.string().min(1),
        city: zod_1.z.string().min(1),
        state: zod_1.z.string().min(1),
        postalCode: zod_1.z.string().min(1),
        country: zod_1.z.string().min(1),
    }),
});
// Export all schemas
exports.schemas = {
    product: exports.productSchema,
    order: exports.orderSchema,
    customer: exports.customerSchema,
};
// Custom error messages
exports.validationErrors = {
    REQUIRED: 'This field is required',
    INVALID_EMAIL: 'Invalid email address',
    INVALID_URL: 'Invalid URL',
    INVALID_DATE: 'Invalid date format',
    INVALID_NUMBER: 'Invalid number',
    MIN_LENGTH: (min) => `Minimum length is ${min} characters`,
    MAX_LENGTH: (max) => `Maximum length is ${max} characters`,
    MIN_VALUE: (min) => `Minimum value is ${min}`,
    MAX_VALUE: (max) => `Maximum value is ${max}`,
};
