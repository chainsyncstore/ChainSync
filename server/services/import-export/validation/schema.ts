import { z } from 'zod';

// Base schema for all import/export data
export const baseSchema = z.object({
  _id: z.number().int(),
  _createdAt: z.string().datetime(),
  _updatedAt: z.string().datetime(),
  _status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'])
});

// Product-specific validation schema
export const productSchema = baseSchema.extend({
  _name: z.string().min(1, 'Product name is required').max(255),
  _description: z.string().optional(),
  _price: z.number().min(0, 'Price must be non-negative'),
  _quantity: z.number().int().min(0, 'Quantity must be non-negative'),
  _sku: z.string().min(1, 'SKU is required').max(50),
  _category: z.string().optional(),
  _tags: z.array(z.string()).optional(),
  _images: z.array(z.string().url()).optional(),
  _status: z.enum(['ACTIVE', 'INACTIVE'])
});

// Order-specific validation schema
export const orderSchema = baseSchema.extend({
  _userId: z.number(),
  _items: z.array(z.object({
    _productId: z.number(),
    _quantity: z.number().min(1)
  })),
  _status: z.enum(['PENDING', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
  _shippingAddress: z.object({
    _street: z.string().min(1),
    _city: z.string().min(1),
    _state: z.string().min(1),
    _postalCode: z.string().min(1),
    _country: z.string().min(1)
  })
});

// Customer-specific validation schema
export const customerSchema = baseSchema.extend({
  _firstName: z.string().min(1, 'First name is required').max(50),
  _lastName: z.string().min(1, 'Last name is required').max(50),
  _email: z.string().email('Invalid email address'),
  _phone: z.string().optional(),
  _address: z.object({
    _street: z.string().min(1),
    _city: z.string().min(1),
    _state: z.string().min(1),
    _postalCode: z.string().min(1),
    _country: z.string().min(1)
  })
});

// Export all schemas
export const schemas = {
  _product: productSchema,
  _order: orderSchema,
  _customer: customerSchema
};

// Custom error messages
export const validationErrors = {
  REQUIRED: 'This field is required',
  _INVALID_EMAIL: 'Invalid email address',
  _INVALID_URL: 'Invalid URL',
  _INVALID_DATE: 'Invalid date format',
  _INVALID_NUMBER: 'Invalid number',
  _MIN_LENGTH: (_min: number) => `Minimum length is ${min} characters`,
  _MAX_LENGTH: (_max: number) => `Maximum length is ${max} characters`,
  _MIN_VALUE: (_min: number) => `Minimum value is ${min}`,
  _MAX_VALUE: (_max: number) => `Maximum value is ${max}`
};
