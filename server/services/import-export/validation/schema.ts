import { z } from 'zod';
import { ImportExportErrorCode } from '../../../shared/types/import-export-errors';

// Base schema for all import/export data
export const baseSchema = z.object({
  id: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']),
});

// Product-specific validation schema
export const productSchema = baseSchema.extend({
  name: z.string().min(1, 'Product name is required').max(255),
  description: z.string().optional(),
  price: z.number().min(0, 'Price must be non-negative'),
  quantity: z.number().int().min(0, 'Quantity must be non-negative'),
  sku: z.string().min(1, 'SKU is required').max(50),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  images: z.array(z.string().url()).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']),
});

// Order-specific validation schema
export const orderSchema = baseSchema.extend({
  userId: z.number(),
  items: z.array(z.object({
    productId: z.number(),
    quantity: z.number().min(1),
  })),
  status: z.enum(['PENDING', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
  shippingAddress: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    postalCode: z.string().min(1),
    country: z.string().min(1),
  }),
});

// Customer-specific validation schema
export const customerSchema = baseSchema.extend({
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  address: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    postalCode: z.string().min(1),
    country: z.string().min(1),
  }),
});

// Export all schemas
export const schemas = {
  product: productSchema,
  order: orderSchema,
  customer: customerSchema,
};

// Custom error messages
export const validationErrors = {
  REQUIRED: 'This field is required',
  INVALID_EMAIL: 'Invalid email address',
  INVALID_URL: 'Invalid URL',
  INVALID_DATE: 'Invalid date format',
  INVALID_NUMBER: 'Invalid number',
  MIN_LENGTH: (min: number) => `Minimum length is ${min} characters`,
  MAX_LENGTH: (max: number) => `Maximum length is ${max} characters`,
  MIN_VALUE: (min: number) => `Minimum value is ${min}`,
  MAX_VALUE: (max: number) => `Maximum value is ${max}`,
};
