import { z } from 'zod';

// Common validation patterns
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+?[\d\s\-\(\)]{10,}$/;
const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Base schemas
export const baseIdSchema = z.object({
  _id: z.string().uuid('Invalid ID format')
});

export const paginationSchema = z.object({
  _page: z.coerce.number().int().min(1).default(1),
  _limit: z.coerce.number().int().min(1).max(100).default(20),
  _sortBy: z.string().optional(),
  _sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export const dateRangeSchema = z.object({
  _startDate: z.string().datetime().optional(),
  _endDate: z.string().datetime().optional()
});

// User schemas
export const userRegistrationSchema = z.object({
  _email: z.string().email('Invalid email format'),
  _password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(passwordPattern, 'Password must contain uppercase, lowercase, number, and special character'),
  _confirmPassword: z.string(),
  _firstName: z.string().min(2, 'First name must be at least 2 characters').max(50),
  _lastName: z.string().min(2, 'Last name must be at least 2 characters').max(50),
  _phone: z.string().regex(phonePattern, 'Invalid phone number format').optional(),
  _role: z.enum(['admin', 'manager', 'cashier', 'viewer']).default('viewer'),
  _storeId: z.number().int().positive().optional()
}).refine((data) => data.password === data.confirmPassword, {
  _message: "Passwords don't match",
  _path: ['confirmPassword']
});

export const userLoginSchema = z.object({
  _email: z.string().email('Invalid email format'),
  _password: z.string().min(1, 'Password is required'),
  _rememberMe: z.boolean().default(false)
});

export const userUpdateSchema = z.object({
  _firstName: z.string().min(2).max(50).optional(),
  _lastName: z.string().min(2).max(50).optional(),
  _phone: z.string().regex(phonePattern).optional(),
  _role: z.enum(['admin', 'manager', 'cashier', 'viewer']).optional(),
  _storeId: z.number().int().positive().optional(),
  _isActive: z.boolean().optional()
});

export const passwordChangeSchema = z.object({
  _currentPassword: z.string().min(1, 'Current password is required'),
  _newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(passwordPattern, 'Password must contain uppercase, lowercase, number, and special character'),
  _confirmNewPassword: z.string()
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  _message: "New passwords don't match",
  _path: ['confirmNewPassword']
});

export const passwordResetRequestSchema = z.object({
  _email: z.string().email('Invalid email format')
});

export const passwordResetSchema = z.object({
  _token: z.string().min(1, 'Reset token is required'),
  _newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(passwordPattern, 'Password must contain uppercase, lowercase, number, and special character'),
  _confirmNewPassword: z.string()
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  _message: "New passwords don't match",
  _path: ['confirmNewPassword']
});

// Product schemas
export const productCreateSchema = z.object({
  _name: z.string().min(2, 'Product name must be at least 2 characters').max(100),
  _description: z.string().max(500).optional(),
  _sku: z.string().min(3, 'SKU must be at least 3 characters').max(50),
  _barcode: z.string().max(50).optional(),
  _category: z.string().min(2).max(50),
  _brand: z.string().min(2).max(50).optional(),
  _unit: z.string().min(1).max(20),
  _costPrice: z.number().positive('Cost price must be positive'),
  _sellingPrice: z.number().positive('Selling price must be positive'),
  _taxRate: z.number().min(0).max(100).default(0),
  _reorderPoint: z.number().int().min(0).default(0),
  _isActive: z.boolean().default(true),
  _storeId: z.number().int().positive()
});

export const productUpdateSchema = productCreateSchema.partial().extend({
  _id: z.string().uuid('Invalid product ID')
});

export const productSearchSchema = z.object({
  _query: z.string().min(1).max(100).optional(),
  _category: z.string().optional(),
  _brand: z.string().optional(),
  _minPrice: z.coerce.number().positive().optional(),
  _maxPrice: z.coerce.number().positive().optional(),
  _inStock: z.coerce.boolean().optional(),
  _isActive: z.coerce.boolean().optional(),
  ...paginationSchema.shape
});

// Inventory schemas
export const inventoryBatchSchema = z.object({
  _productId: z.number().int().positive(),
  _storeId: z.number().int().positive(),
  _batchNumber: z.string().min(1).max(50),
  _quantity: z.number().int().positive('Quantity must be positive'),
  _costPerUnit: z.number().positive('Cost per unit must be positive'),
  _expiryDate: z.string().datetime().optional(),
  _manufacturingDate: z.string().datetime().optional(),
  _supplier: z.string().max(100).optional(),
  _notes: z.string().max(500).optional()
});

export const inventoryAdjustmentSchema = z.object({
  _productId: z.number().int().positive(),
  _storeId: z.number().int().positive(),
  _quantity: z.number().int(),
  _reason: z.enum(['damage', 'theft', 'expiry', 'correction', 'other']),
  _notes: z.string().max(500).optional(),
  _batchId: z.number().int().positive().optional()
});

// Transaction schemas
export const transactionCreateSchema = z.object({
  _customerId: z.number().int().positive().optional(),
  _items: z.array(z.object({
    _productId: z.number().int().positive(),
    _quantity: z.number().int().positive(),
    _unitPrice: z.number().positive(),
    _discount: z.number().min(0).default(0)
  })).min(1, 'At least one item is required'),
  _paymentMethod: z.enum(['cash', 'card', 'mobile_money', 'bank_transfer']),
  _paymentStatus: z.enum(['pending', 'completed', 'failed', 'refunded']).default('pending'),
  _totalAmount: z.number().positive(),
  _taxAmount: z.number().min(0).default(0),
  _discountAmount: z.number().min(0).default(0),
  _notes: z.string().max(500).optional(),
  _storeId: z.number().int().positive()
});

export const transactionUpdateSchema = z.object({
  _id: z.string().uuid('Invalid transaction ID'),
  _paymentStatus: z.enum(['pending', 'completed', 'failed', 'refunded']).optional(),
  _notes: z.string().max(500).optional()
});

export const transactionSearchSchema = z.object({
  _startDate: z.string().datetime().optional(),
  _endDate: z.string().datetime().optional(),
  _paymentStatus: z.enum(['pending', 'completed', 'failed', 'refunded']).optional(),
  _paymentMethod: z.enum(['cash', 'card', 'mobile_money', 'bank_transfer']).optional(),
  _minAmount: z.coerce.number().positive().optional(),
  _maxAmount: z.coerce.number().positive().optional(),
  _customerId: z.coerce.number().int().positive().optional(),
  ...paginationSchema.shape
});

// Customer schemas
export const customerCreateSchema = z.object({
  _firstName: z.string().min(2).max(50),
  _lastName: z.string().min(2).max(50),
  _email: z.string().email().optional(),
  _phone: z.string().regex(phonePattern, 'Invalid phone number format'),
  _address: z.string().max(200).optional(),
  _dateOfBirth: z.string().datetime().optional(),
  _loyaltyPoints: z.number().int().min(0).default(0),
  _isActive: z.boolean().default(true),
  _storeId: z.number().int().positive()
});

export const customerUpdateSchema = customerCreateSchema.partial().extend({
  _id: z.string().uuid('Invalid customer ID')
});

export const customerSearchSchema = z.object({
  _query: z.string().min(1).max(100).optional(),
  _isActive: z.coerce.boolean().optional(),
  _hasLoyaltyPoints: z.coerce.boolean().optional(),
  ...paginationSchema.shape
});

// Store schemas
export const storeCreateSchema = z.object({
  _name: z.string().min(2).max(100),
  _address: z.string().min(10).max(200),
  _phone: z.string().regex(phonePattern),
  _email: z.string().email().optional(),
  _managerId: z.number().int().positive().optional(),
  _isActive: z.boolean().default(true),
  _timezone: z.string().default('UTC'),
  _currency: z.string().length(3).default('USD')
});

export const storeUpdateSchema = storeCreateSchema.partial().extend({
  _id: z.string().uuid('Invalid store ID')
});

// Loyalty schemas
export const loyaltyEarnSchema = z.object({
  _customerId: z.number().int().positive(),
  _points: z.number().int().positive(),
  _source: z.enum(['purchase', 'referral', 'bonus', 'manual']),
  _transactionId: z.number().int().positive().optional(),
  _notes: z.string().max(500).optional()
});

export const loyaltyRedeemSchema = z.object({
  _customerId: z.number().int().positive(),
  _rewardId: z.number().int().positive(),
  _quantity: z.number().int().positive().default(1)
});

// Report schemas
export const reportDateRangeSchema = z.object({
  _startDate: z.string().datetime('Invalid start date'),
  _endDate: z.string().datetime('Invalid end date'),
  _storeId: z.number().int().positive().optional(),
  _groupBy: z.enum(['day', 'week', 'month', 'year']).default('day')
});

export const salesReportSchema = reportDateRangeSchema.extend({
  _includeRefunds: z.boolean().default(false),
  _paymentMethod: z.enum(['all', 'cash', 'card', 'mobile_money', 'bank_transfer']).default('all')
});

export const inventoryReportSchema = reportDateRangeSchema.extend({
  _includeInactive: z.boolean().default(false),
  _lowStock: z.boolean().default(false),
  _category: z.string().optional()
});

// Export schemas
export const exportSchema = z.object({
  _format: z.enum(['csv', 'excel', 'pdf']).default('csv'),
  _filters: z.record(z.string(), z.any()).optional(),
  _includeHeaders: z.boolean().default(true)
});

// Search and filter schemas
export const searchSchema = z.object({
  _q: z.string().min(1).max(100),
  _type: z.enum(['products', 'customers', 'transactions']).optional(),
  _limit: z.coerce.number().int().min(1).max(50).default(10)
});

// Bulk operation schemas
export const bulkDeleteSchema = z.object({
  _ids: z.array(z.string().uuid()).min(1, 'At least one ID is required').max(100)
});

export const bulkUpdateSchema = z.object({
  _ids: z.array(z.string().uuid()).min(1).max(100),
  _updates: z.record(z.string(), z.any())
});

// File upload schemas
export const fileUploadSchema = z.object({
  _file: z.any().refine((file) => file && file.size > 0, 'File is required'),
  _type: z.enum(['product', 'customer', 'transaction']),
  _overwrite: z.boolean().default(false)
});

// Notification schemas
export const notificationCreateSchema = z.object({
  _title: z.string().min(1).max(100),
  _message: z.string().min(1).max(500),
  _type: z.enum(['info', 'warning', 'error', 'success']).default('info'),
  _recipients: z.array(z.number().int().positive()).optional(),
  _storeId: z.number().int().positive().optional(),
  _scheduledAt: z.string().datetime().optional()
});

// Settings schemas
export const settingsUpdateSchema = z.object({
  _storeName: z.string().min(2).max(100).optional(),
  _currency: z.string().length(3).optional(),
  _timezone: z.string().optional(),
  _taxRate: z.number().min(0).max(100).optional(),
  _lowStockThreshold: z.number().int().min(0).optional(),
  _enableNotifications: z.boolean().optional(),
  _enableLoyalty: z.boolean().optional(),
  _receiptFooter: z.string().max(200).optional()
});

// API key schemas
export const apiKeyCreateSchema = z.object({
  _name: z.string().min(2).max(50),
  _permissions: z.array(z.enum(['read', 'write', 'admin'])).min(1),
  _expiresAt: z.string().datetime().optional()
});

// Webhook schemas
export const webhookCreateSchema = z.object({
  _url: z.string().url('Invalid webhook URL'),
  _events: z.array(z.enum(['transaction.created', 'transaction.updated', 'inventory.low', 'customer.created'])).min(1),
  _isActive: z.boolean().default(true),
  _secret: z.string().min(16, 'Webhook secret must be at least 16 characters').optional()
});

// Audit log schemas
export const auditLogSearchSchema = z.object({
  _userId: z.coerce.number().int().positive().optional(),
  _action: z.string().optional(),
  _resource: z.string().optional(),
  _startDate: z.string().datetime().optional(),
  _endDate: z.string().datetime().optional(),
  ...paginationSchema.shape
});

// Health check schemas
export const healthCheckSchema = z.object({
  _includeDetails: z.coerce.boolean().default(false),
  _timeout: z.coerce.number().int().min(1000).max(30000).default(5000)
});

// Export all schemas
export const schemas = {
  // User schemas
  _userRegistration: userRegistrationSchema,
  _userLogin: userLoginSchema,
  _userUpdate: userUpdateSchema,
  _passwordChange: passwordChangeSchema,
  _passwordResetRequest: passwordResetRequestSchema,
  _passwordReset: passwordResetSchema,

  // Product schemas
  _productCreate: productCreateSchema,
  _productUpdate: productUpdateSchema,
  _productSearch: productSearchSchema,

  // Inventory schemas
  _inventoryBatch: inventoryBatchSchema,
  _inventoryAdjustment: inventoryAdjustmentSchema,

  // Transaction schemas
  _transactionCreate: transactionCreateSchema,
  _transactionUpdate: transactionUpdateSchema,
  _transactionSearch: transactionSearchSchema,

  // Customer schemas
  _customerCreate: customerCreateSchema,
  _customerUpdate: customerUpdateSchema,
  _customerSearch: customerSearchSchema,

  // Store schemas
  _storeCreate: storeCreateSchema,
  _storeUpdate: storeUpdateSchema,

  // Loyalty schemas
  _loyaltyEarn: loyaltyEarnSchema,
  _loyaltyRedeem: loyaltyRedeemSchema,

  // Report schemas
  _salesReport: salesReportSchema,
  _inventoryReport: inventoryReportSchema,

  // Export schemas
  _export: exportSchema,
  _search: searchSchema,
  _bulkDelete: bulkDeleteSchema,
  _bulkUpdate: bulkUpdateSchema,

  // File upload schemas
  _fileUpload: fileUploadSchema,

  // Notification schemas
  _notificationCreate: notificationCreateSchema,

  // Settings schemas
  _settingsUpdate: settingsUpdateSchema,

  // API key schemas
  _apiKeyCreate: apiKeyCreateSchema,

  // Webhook schemas
  _webhookCreate: webhookCreateSchema,

  // Audit log schemas
  _auditLogSearch: auditLogSearchSchema,

  // Health check schemas
  _healthCheck: healthCheckSchema,

  // Common schemas
  _baseId: baseIdSchema,
  _pagination: paginationSchema,
  _dateRange: dateRangeSchema
};
