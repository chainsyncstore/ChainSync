'use strict';
Object.defineProperty(exports, '__esModule', { _value: true });
exports.validationErrors = exports.schemas = exports.customerSchema = exports.orderSchema = exports.productSchema = exports.baseSchema = void 0;
const zod_1 = require('zod');
// Base schema for all import/export data
exports.baseSchema = zod_1.z.object({
  _id: zod_1.z.number().int(),
  _createdAt: zod_1.z.string().datetime(),
  _updatedAt: zod_1.z.string().datetime(),
  _status: zod_1.z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'])
});
// Product-specific validation schema
exports.productSchema = exports.baseSchema.extend({
  _name: zod_1.z.string().min(1, 'Product name is required').max(255),
  _description: zod_1.z.string().optional(),
  _price: zod_1.z.number().min(0, 'Price must be non-negative'),
  _quantity: zod_1.z.number().int().min(0, 'Quantity must be non-negative'),
  _sku: zod_1.z.string().min(1, 'SKU is required').max(50),
  _category: zod_1.z.string().optional(),
  _tags: zod_1.z.array(zod_1.z.string()).optional(),
  _images: zod_1.z.array(zod_1.z.string().url()).optional(),
  _status: zod_1.z.enum(['ACTIVE', 'INACTIVE'])
});
// Order-specific validation schema
exports.orderSchema = exports.baseSchema.extend({
  _userId: zod_1.z.number(),
  _items: zod_1.z.array(zod_1.z.object({
    _productId: zod_1.z.number(),
    _quantity: zod_1.z.number().min(1)
  })),
  _status: zod_1.z.enum(['PENDING', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
  _shippingAddress: zod_1.z.object({
    _street: zod_1.z.string().min(1),
    _city: zod_1.z.string().min(1),
    _state: zod_1.z.string().min(1),
    _postalCode: zod_1.z.string().min(1),
    _country: zod_1.z.string().min(1)
  })
});
// Customer-specific validation schema
exports.customerSchema = exports.baseSchema.extend({
  _firstName: zod_1.z.string().min(1, 'First name is required').max(50),
  _lastName: zod_1.z.string().min(1, 'Last name is required').max(50),
  _email: zod_1.z.string().email('Invalid email address'),
  _phone: zod_1.z.string().optional(),
  _address: zod_1.z.object({
    _street: zod_1.z.string().min(1),
    _city: zod_1.z.string().min(1),
    _state: zod_1.z.string().min(1),
    _postalCode: zod_1.z.string().min(1),
    _country: zod_1.z.string().min(1)
  })
});
// Export all schemas
exports.schemas = {
  _product: exports.productSchema,
  _order: exports.orderSchema,
  _customer: exports.customerSchema
};
// Custom error messages
exports.validationErrors = {
  REQUIRED: 'This field is required',
  _INVALID_EMAIL: 'Invalid email address',
  _INVALID_URL: 'Invalid URL',
  _INVALID_DATE: 'Invalid date format',
  _INVALID_NUMBER: 'Invalid number',
  _MIN_LENGTH: (min) => `Minimum length is ${min} characters`,
  _MAX_LENGTH: (max) => `Maximum length is ${max} characters`,
  _MIN_VALUE: (min) => `Minimum value is ${min}`,
  _MAX_VALUE: (max) => `Maximum value is ${max}`
};
