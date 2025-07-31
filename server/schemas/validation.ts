import { z } from 'zod';

// Common validation patterns
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+?[\d\s\-\(\)]{10,}$/;
const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Base schemas
export const baseIdSchema = z.object({
  id: z.string().uuid('Invalid ID format')
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
});

// User schemas
export const userRegistrationSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(passwordPattern, 'Password must contain uppercase, lowercase, number, and special character'),
  confirmPassword: z.string(),
  firstName: z.string().min(2, 'First name must be at least 2 characters').max(50),
  lastName: z.string().min(2, 'Last name must be at least 2 characters').max(50),
  phone: z.string().regex(phonePattern, 'Invalid phone number format').optional(),
  role: z.enum(['admin', 'manager', 'cashier', 'viewer']).default('viewer'),
  storeId: z.number().int().positive().optional()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

export const userLoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false)
});

export const userUpdateSchema = z.object({
  firstName: z.string().min(2).max(50).optional(),
  lastName: z.string().min(2).max(50).optional(),
  phone: z.string().regex(phonePattern).optional(),
  role: z.enum(['admin', 'manager', 'cashier', 'viewer']).optional(),
  storeId: z.number().int().positive().optional(),
  isActive: z.boolean().optional()
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(passwordPattern, 'Password must contain uppercase, lowercase, number, and special character'),
  confirmNewPassword: z.string()
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: "New passwords don't match",
  path: ["confirmNewPassword"]
});

export const passwordResetRequestSchema = z.object({
  email: z.string().email('Invalid email format')
});

export const passwordResetSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(passwordPattern, 'Password must contain uppercase, lowercase, number, and special character'),
  confirmNewPassword: z.string()
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: "New passwords don't match",
  path: ["confirmNewPassword"]
});

// Product schemas
export const productCreateSchema = z.object({
  name: z.string().min(2, 'Product name must be at least 2 characters').max(100),
  description: z.string().max(500).optional(),
  sku: z.string().min(3, 'SKU must be at least 3 characters').max(50),
  barcode: z.string().max(50).optional(),
  category: z.string().min(2).max(50),
  brand: z.string().min(2).max(50).optional(),
  unit: z.string().min(1).max(20),
  costPrice: z.number().positive('Cost price must be positive'),
  sellingPrice: z.number().positive('Selling price must be positive'),
  taxRate: z.number().min(0).max(100).default(0),
  reorderPoint: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  storeId: z.number().int().positive()
});

export const productUpdateSchema = productCreateSchema.partial().extend({
  id: z.string().uuid('Invalid product ID')
});

export const productSearchSchema = z.object({
  query: z.string().min(1).max(100).optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  minPrice: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  inStock: z.coerce.boolean().optional(),
  isActive: z.coerce.boolean().optional(),
  ...paginationSchema.shape
});

// Inventory schemas
export const inventoryBatchSchema = z.object({
  productId: z.number().int().positive(),
  storeId: z.number().int().positive(),
  batchNumber: z.string().min(1).max(50),
  quantity: z.number().int().positive('Quantity must be positive'),
  costPerUnit: z.number().positive('Cost per unit must be positive'),
  expiryDate: z.string().datetime().optional(),
  manufacturingDate: z.string().datetime().optional(),
  supplier: z.string().max(100).optional(),
  notes: z.string().max(500).optional()
});

export const inventoryAdjustmentSchema = z.object({
  productId: z.number().int().positive(),
  storeId: z.number().int().positive(),
  quantity: z.number().int(),
  reason: z.enum(['damage', 'theft', 'expiry', 'correction', 'other']),
  notes: z.string().max(500).optional(),
  batchId: z.number().int().positive().optional()
});

// Transaction schemas
export const transactionCreateSchema = z.object({
  customerId: z.number().int().positive().optional(),
  items: z.array(z.object({
    productId: z.number().int().positive(),
    quantity: z.number().int().positive(),
    unitPrice: z.number().positive(),
    discount: z.number().min(0).default(0)
  })).min(1, 'At least one item is required'),
  paymentMethod: z.enum(['cash', 'card', 'mobile_money', 'bank_transfer']),
  paymentStatus: z.enum(['pending', 'completed', 'failed', 'refunded']).default('pending'),
  totalAmount: z.number().positive(),
  taxAmount: z.number().min(0).default(0),
  discountAmount: z.number().min(0).default(0),
  notes: z.string().max(500).optional(),
  storeId: z.number().int().positive()
});

export const transactionUpdateSchema = z.object({
  id: z.string().uuid('Invalid transaction ID'),
  paymentStatus: z.enum(['pending', 'completed', 'failed', 'refunded']).optional(),
  notes: z.string().max(500).optional()
});

export const transactionSearchSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  paymentStatus: z.enum(['pending', 'completed', 'failed', 'refunded']).optional(),
  paymentMethod: z.enum(['cash', 'card', 'mobile_money', 'bank_transfer']).optional(),
  minAmount: z.coerce.number().positive().optional(),
  maxAmount: z.coerce.number().positive().optional(),
  customerId: z.coerce.number().int().positive().optional(),
  ...paginationSchema.shape
});

// Customer schemas
export const customerCreateSchema = z.object({
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  email: z.string().email().optional(),
  phone: z.string().regex(phonePattern, 'Invalid phone number format'),
  address: z.string().max(200).optional(),
  dateOfBirth: z.string().datetime().optional(),
  loyaltyPoints: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  storeId: z.number().int().positive()
});

export const customerUpdateSchema = customerCreateSchema.partial().extend({
  id: z.string().uuid('Invalid customer ID')
});

export const customerSearchSchema = z.object({
  query: z.string().min(1).max(100).optional(),
  isActive: z.coerce.boolean().optional(),
  hasLoyaltyPoints: z.coerce.boolean().optional(),
  ...paginationSchema.shape
});

// Store schemas
export const storeCreateSchema = z.object({
  name: z.string().min(2).max(100),
  address: z.string().min(10).max(200),
  phone: z.string().regex(phonePattern),
  email: z.string().email().optional(),
  managerId: z.number().int().positive().optional(),
  isActive: z.boolean().default(true),
  timezone: z.string().default('UTC'),
  currency: z.string().length(3).default('USD')
});

export const storeUpdateSchema = storeCreateSchema.partial().extend({
  id: z.string().uuid('Invalid store ID')
});

// Loyalty schemas
export const loyaltyEarnSchema = z.object({
  customerId: z.number().int().positive(),
  points: z.number().int().positive(),
  source: z.enum(['purchase', 'referral', 'bonus', 'manual']),
  transactionId: z.number().int().positive().optional(),
  notes: z.string().max(500).optional()
});

export const loyaltyRedeemSchema = z.object({
  customerId: z.number().int().positive(),
  rewardId: z.number().int().positive(),
  quantity: z.number().int().positive().default(1)
});

// Report schemas
export const reportDateRangeSchema = z.object({
  startDate: z.string().datetime('Invalid start date'),
  endDate: z.string().datetime('Invalid end date'),
  storeId: z.number().int().positive().optional(),
  groupBy: z.enum(['day', 'week', 'month', 'year']).default('day')
});

export const salesReportSchema = reportDateRangeSchema.extend({
  includeRefunds: z.boolean().default(false),
  paymentMethod: z.enum(['all', 'cash', 'card', 'mobile_money', 'bank_transfer']).default('all')
});

export const inventoryReportSchema = reportDateRangeSchema.extend({
  includeInactive: z.boolean().default(false),
  lowStock: z.boolean().default(false),
  category: z.string().optional()
});

// Export schemas
export const exportSchema = z.object({
  format: z.enum(['csv', 'excel', 'pdf']).default('csv'),
  filters: z.record(z.any()).optional(),
  includeHeaders: z.boolean().default(true)
});

// Search and filter schemas
export const searchSchema = z.object({
  q: z.string().min(1).max(100),
  type: z.enum(['products', 'customers', 'transactions']).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10)
});

// Bulk operation schemas
export const bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'At least one ID is required').max(100)
});

export const bulkUpdateSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  updates: z.record(z.any())
});

// File upload schemas
export const fileUploadSchema = z.object({
  file: z.any().refine((file) => file && file.size > 0, 'File is required'),
  type: z.enum(['product', 'customer', 'transaction']),
  overwrite: z.boolean().default(false)
});

// Notification schemas
export const notificationCreateSchema = z.object({
  title: z.string().min(1).max(100),
  message: z.string().min(1).max(500),
  type: z.enum(['info', 'warning', 'error', 'success']).default('info'),
  recipients: z.array(z.number().int().positive()).optional(),
  storeId: z.number().int().positive().optional(),
  scheduledAt: z.string().datetime().optional()
});

// Settings schemas
export const settingsUpdateSchema = z.object({
  storeName: z.string().min(2).max(100).optional(),
  currency: z.string().length(3).optional(),
  timezone: z.string().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  enableNotifications: z.boolean().optional(),
  enableLoyalty: z.boolean().optional(),
  receiptFooter: z.string().max(200).optional()
});

// API key schemas
export const apiKeyCreateSchema = z.object({
  name: z.string().min(2).max(50),
  permissions: z.array(z.enum(['read', 'write', 'admin'])).min(1),
  expiresAt: z.string().datetime().optional()
});

// Webhook schemas
export const webhookCreateSchema = z.object({
  url: z.string().url('Invalid webhook URL'),
  events: z.array(z.enum(['transaction.created', 'transaction.updated', 'inventory.low', 'customer.created'])).min(1),
  isActive: z.boolean().default(true),
  secret: z.string().min(16, 'Webhook secret must be at least 16 characters').optional()
});

// Audit log schemas
export const auditLogSearchSchema = z.object({
  userId: z.coerce.number().int().positive().optional(),
  action: z.string().optional(),
  resource: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  ...paginationSchema.shape
});

// Health check schemas
export const healthCheckSchema = z.object({
  includeDetails: z.coerce.boolean().default(false),
  timeout: z.coerce.number().int().min(1000).max(30000).default(5000)
});

// Export all schemas
export const schemas = {
  // User schemas
  userRegistration: userRegistrationSchema,
  userLogin: userLoginSchema,
  userUpdate: userUpdateSchema,
  passwordChange: passwordChangeSchema,
  passwordResetRequest: passwordResetRequestSchema,
  passwordReset: passwordResetSchema,
  
  // Product schemas
  productCreate: productCreateSchema,
  productUpdate: productUpdateSchema,
  productSearch: productSearchSchema,
  
  // Inventory schemas
  inventoryBatch: inventoryBatchSchema,
  inventoryAdjustment: inventoryAdjustmentSchema,
  
  // Transaction schemas
  transactionCreate: transactionCreateSchema,
  transactionUpdate: transactionUpdateSchema,
  transactionSearch: transactionSearchSchema,
  
  // Customer schemas
  customerCreate: customerCreateSchema,
  customerUpdate: customerUpdateSchema,
  customerSearch: customerSearchSchema,
  
  // Store schemas
  storeCreate: storeCreateSchema,
  storeUpdate: storeUpdateSchema,
  
  // Loyalty schemas
  loyaltyEarn: loyaltyEarnSchema,
  loyaltyRedeem: loyaltyRedeemSchema,
  
  // Report schemas
  salesReport: salesReportSchema,
  inventoryReport: inventoryReportSchema,
  
  // Export schemas
  export: exportSchema,
  search: searchSchema,
  bulkDelete: bulkDeleteSchema,
  bulkUpdate: bulkUpdateSchema,
  
  // File upload schemas
  fileUpload: fileUploadSchema,
  
  // Notification schemas
  notificationCreate: notificationCreateSchema,
  
  // Settings schemas
  settingsUpdate: settingsUpdateSchema,
  
  // API key schemas
  apiKeyCreate: apiKeyCreateSchema,
  
  // Webhook schemas
  webhookCreate: webhookCreateSchema,
  
  // Audit log schemas
  auditLogSearch: auditLogSearchSchema,
  
  // Health check schemas
  healthCheck: healthCheckSchema,
  
  // Common schemas
  baseId: baseIdSchema,
  pagination: paginationSchema,
  dateRange: dateRangeSchema
}; 