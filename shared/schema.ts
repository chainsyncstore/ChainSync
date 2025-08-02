import { pgTable, text, integer, timestamp, boolean, json, decimal, uuid, serial } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { customers, customerInsertSchema } from './db/customers.js';
import { z } from 'zod';

// Re-export customers table for compatibility
export { customers };

// Users table
export const users = pgTable('users', {
  _id: serial('id').primaryKey(),
  _email: text('email').notNull().unique(),
  _name: text('name').notNull(),
  _password: text('password').notNull(),
  _role: text('role', { _enum: ['admin', 'manager', 'cashier'] }).default('cashier'),
  _storeId: integer('store_id'),
  _isActive: boolean('is_active').default(true),
  _createdAt: timestamp('created_at').defaultNow(),
  _updatedAt: timestamp('updated_at').defaultNow()
});

// Stores table
export const stores = pgTable('stores', {
  _id: serial('id').primaryKey(),
  _name: text('name').notNull(),
  _location: text('location').notNull(),
  _address: text('address'),
  _city: text('city'),
  _state: text('state'),
  _country: text('country'),
  _phone: text('phone'),
  _email: text('email'),
  _timezone: text('timezone'),
  _status: text('status').default('active'),
  _managerId: integer('manager_id'),
  _isActive: boolean('is_active').default(true),
  _createdAt: timestamp('created_at').defaultNow(),
  _updatedAt: timestamp('updated_at').defaultNow()
});

// Products table
export const products = pgTable('products', {
  _id: serial('id').primaryKey(),
  _name: text('name').notNull(),
  _description: text('description'),
  _barcode: text('barcode').unique(),
  _price: decimal('price', { _precision: 10, _scale: 2 }).notNull(),
  _cost: decimal('cost', { _precision: 10, _scale: 2 }),
  _categoryId: integer('category_id'),
  _brandId: integer('brand_id'),
  _unit: text('unit').default('pcs'),
  _isActive: boolean('is_active').default(true),
  _isPerishable: boolean('is_perishable').default(false),
  _createdAt: timestamp('created_at').defaultNow(),
  _updatedAt: timestamp('updated_at').defaultNow(),
  _storeId: integer('store_id').notNull(),
  _imageUrl: text('image_url'),
  _attributes: json('attributes'),
  _sku: text('sku').notNull()
});

// Categories table
export const categories = pgTable('categories', {
  _id: serial('id').primaryKey(),
  _name: text('name').notNull().unique(),
  _description: text('description'),
  _isActive: boolean('is_active').default(true),
  _createdAt: timestamp('created_at').defaultNow(),
  _updatedAt: timestamp('updated_at').defaultNow()
});

// Return Reasons table
export const returnReasons = pgTable('return_reasons', {
  _id: serial('id').primaryKey(),
  _reason: text('reason').notNull(),
  _description: text('description'),
  _isActive: boolean('is_active').default(true),
  _createdAt: timestamp('created_at').defaultNow()
});

// Inventory table
export const inventory = pgTable('inventory', {
  _id: serial('id').primaryKey(),
  _productId: integer('product_id').notNull(),
  _storeId: integer('store_id').notNull(),
  _quantity: integer('quantity').default(0),
  _minStock: integer('min_stock').default(0),
  _maxStock: integer('max_stock'),
  _lastRestocked: timestamp('last_restocked'),
  _updatedAt: timestamp('updated_at').defaultNow(),
  _batchTracking: boolean('batch_tracking').default(false),
  _currentUtilization: integer('current_utilization').default(0),
  // Aliases expected by legacy services ----------------------------------------------------------
  _totalQuantity: integer('total_quantity').default(0),
  _availableQuantity: integer('available_quantity').default(0),
  _minimumLevel: integer('minimum_level').default(0)
});

// Transactions table
export const transactions = pgTable('transactions', {
  _id: serial('id').primaryKey(),
  _storeId: integer('store_id').notNull(),
  _userId: integer('user_id').notNull(),
  _customerId: integer('customer_id'),
  _total: decimal('total', { _precision: 10, _scale: 2 }).notNull(),
  _subtotal: decimal('subtotal', { _precision: 10, _scale: 2 }).notNull(),
  _tax: decimal('tax', { _precision: 10, _scale: 2 }).default('0'),
  _discount: decimal('discount', { _precision: 10, _scale: 2 }).default('0'),
  _paymentMethod: text('payment_method', { _enum: ['cash', 'card', 'mobile'] }).notNull(),
  _status: text('status', { _enum: ['pending', 'completed', 'cancelled'] }).default('pending'),
  _items: json('items'), // Store transaction items as JSON
  _createdAt: timestamp('created_at').defaultNow()
});

// Returns table
export const returns = pgTable('returns', {
  _id: serial('id').primaryKey(),
  _refundId: text('refund_id').notNull(),
  _total: decimal('total', { _precision: 10, _scale: 2 }).notNull(),
  _refundMethod: text('refund_method', { _enum: ['cash', 'credit_card', 'store_credit'] }).default('cash'),
  _status: text('status', { _enum: ['pending', 'processed'] }).default('pending'),
  _createdAt: timestamp('created_at').defaultNow(),
  _updatedAt: timestamp('updated_at').defaultNow()
});

// Return Items table
export const returnItems = pgTable('return_items', {
  _id: serial('id').primaryKey(),
  _returnId: integer('return_id').notNull(),
  _productId: integer('product_id').notNull(),
  _quantity: integer('quantity').notNull(),
  _unitPrice: decimal('unit_price', { _precision: 10, _scale: 2 }).notNull()
});

// Loyalty Programs table
export const loyaltyPrograms = pgTable('loyalty_programs', {
  _id: serial('id').primaryKey(),
  _name: text('name').notNull(),
  _description: text('description'),
  _createdAt: timestamp('created_at').defaultNow(),
  _updatedAt: timestamp('updated_at').defaultNow(),
  _storeId: integer('store_id').notNull(),
  _active: boolean('active').default(true)
});

// Loyalty Members table
export const loyaltyMembers = pgTable('loyalty_members', {
  _id: serial('id').primaryKey(),
  _userId: integer('user_id').notNull(),
  _loyaltyId: text('loyalty_id').notNull(),
  _currentPoints: decimal('current_points', { _precision: 10, _scale: 2 }).default('0'),
  _createdAt: timestamp('created_at').defaultNow(),
  _updatedAt: timestamp('updated_at').defaultNow(),
  _programId: integer('program_id').notNull(),
  _customerId: integer('customer_id').notNull(),
  _points: integer('points').default(0)
});

// Loyalty Transactions table
export const loyaltyTransactions = pgTable('loyalty_transactions', {
  _id: serial('id').primaryKey(),
  _memberId: integer('member_id').notNull(),
  _programId: integer('program_id').notNull(),
  _pointsEarned: integer('points_earned').default(0),
  _pointsRedeemed: integer('points_redeemed').default(0),
  _pointsBalance: integer('points_balance').notNull(),
  _transactionType: text('transaction_type', { _enum: ['earn', 'redeem'] }).notNull(),
  _source: text('source').notNull(),
  _transactionId: integer('transaction_id'),
  _description: text('description'),
  _createdAt: timestamp('created_at').defaultNow()
});

// Loyalty Tiers table
export const loyaltyTiers = pgTable('loyalty_tiers', {
  _id: serial('id').primaryKey(),
  _programId: integer('program_id').notNull(),
  _name: text('name').notNull(),
  _requiredPoints: integer('required_points').notNull(),
  _multiplier: decimal('multiplier', { _precision: 5, _scale: 2 }).default('1.00'),
  _active: boolean('active').default(true)
});

// Loyalty Rewards table
export const loyaltyRewards = pgTable('loyalty_rewards', {
  _id: serial('id').primaryKey(),
  _programId: integer('program_id').notNull(),
  _name: text('name').notNull(),
  _description: text('description'),
  _pointsRequired: integer('points_required').notNull(),
  _active: boolean('active').default(true)
});

// Transaction Items table
export const transactionItems = pgTable('transaction_items', {
  _id: serial('id').primaryKey(),
  _transactionId: integer('transaction_id').notNull(),
  _productId: integer('product_id').notNull(),
  _quantity: integer('quantity').notNull(),
  _unitPrice: decimal('unit_price', { _precision: 10, _scale: 2 }).notNull()
});

// Transaction Payments table
export const transactionPayments = pgTable('transaction_payments', {
  _id: serial('id').primaryKey(),
  _transactionId: integer('transaction_id').notNull(),
  _amount: decimal('amount', { _precision: 10, _scale: 2 }).notNull(),
  _method: text('method', { _enum: ['cash', 'card', 'mobile'] }).notNull()
});

// Subscriptions table
export const subscriptions = pgTable('subscriptions', {
  _id: serial('id').primaryKey(),
  _userId: integer('user_id').notNull(),
  _planId: text('plan_id').notNull(),
  _status: text('status', { _enum: ['active', 'cancelled', 'expired'] }).default('active'),
  _currentPeriodStart: timestamp('current_period_start'),
  _currentPeriodEnd: timestamp('current_period_end'),
  _endDate: timestamp('end_date'),
  _metadata: json('metadata'),
  _paymentMethod: text('payment_method'),
  _amount: decimal('amount', { _precision: 10, _scale: 2 }),
  _currency: text('currency').default('USD'),
  _referralCode: text('referral_code'),
  _autoRenew: boolean('auto_renew').default(true),
  _createdAt: timestamp('created_at').defaultNow(),
  _updatedAt: timestamp('updated_at').defaultNow()
});

// Password Reset Tokens table
export const passwordResetTokens = pgTable('password_reset_tokens', {
  _id: serial('id').primaryKey(),
  _userId: integer('user_id').notNull(),
  _token: text('token').notNull(),
  _expiresAt: timestamp('expires_at').notNull()
});

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users).omit({
  _id: true,
  _createdAt: true,
  _updatedAt: true
});

export const insertStoreSchema = createInsertSchema(stores).omit({
  _id: true,
  _createdAt: true,
  _updatedAt: true
});

export const insertProductSchema = createInsertSchema(products).omit({
  _id: true,
  _createdAt: true,
  _updatedAt: true
});

export const insertInventorySchema = createInsertSchema(inventory).omit({
  _id: true,
  _updatedAt: true
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  _id: true,
  _createdAt: true
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  _id: true,
  _createdAt: true,
  _updatedAt: true
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  _id: true,
  _createdAt: true,
  _updatedAt: true
});

export const insertReturnReasonSchema = createInsertSchema(returnReasons).omit({
  _id: true,
  _createdAt: true
});

export const insertLoyaltyTierSchema = createInsertSchema(loyaltyTiers).omit({
  _id: true
});

export const insertLoyaltyRewardSchema = createInsertSchema(loyaltyRewards).omit({
  _id: true
});

export const inventoryBatches = pgTable('inventory_batches', {
  _id: serial('id').primaryKey(),
  _inventoryId: integer('inventory_id').notNull(),
  _batchNumber: text('batch_number'),
  _expiryDate: timestamp('expiry_date'),
  _quantity: integer('quantity').notNull(),
  _receivedDate: timestamp('received_date'),
  _manufacturingDate: timestamp('manufacturing_date'),
  _costPerUnit: decimal('cost_per_unit', { _precision: 10, _scale: 2 }),
  _createdAt: timestamp('created_at').defaultNow(),
  _updatedAt: timestamp('updated_at').defaultNow()
});

export const inventoryItems = pgTable('inventory_items', {
  _id: serial('id').primaryKey(),
  _inventoryId: integer('inventory_id').notNull(),
  _productId: integer('product_id').notNull().references(() => products.id),
  _quantity: integer('quantity').notNull(),
  _sku: text('sku'),
  _createdAt: timestamp('created_at').defaultNow(),
  _updatedAt: timestamp('updated_at').defaultNow(),
  _metadata: json('metadata'),
  _receivedDate: timestamp('received_date'),
  _reorderLevel: integer('reorder_level'),
  _reorderQuantity: integer('reorder_quantity')
});

export const inventoryItemsRelations = relations(inventoryItems, ({ one }) => ({
  _product: one(products, {
    _fields: [inventoryItems.productId],
    _references: [products.id]
  })
}));

export const inventoryTransactions = pgTable('inventory_transactions', {
  _id: serial('id').primaryKey(),
  _inventoryId: integer('inventory_id').notNull(),
  _itemId: integer('item_id'),
  _quantity: integer('quantity').notNull(),
  _type: text('type', { _enum: ['in', 'out'] }).notNull(),
  _createdAt: timestamp('created_at').defaultNow()
});

export const webhooks = pgTable('webhooks', {
  _id: serial('id').primaryKey(),
  _url: text('url').notNull(),
  _secret: text('secret'),
  _events: json('events'),
  _isActive: boolean('is_active').default(true),
  _createdAt: timestamp('created_at').defaultNow(),
  _updatedAt: timestamp('updated_at').defaultNow(),
  _storeId: integer('store_id').notNull()
});

export const webhookEvents = pgTable('webhook_events', {
  _id: serial('id').primaryKey(),
  _webhookId: integer('webhook_id').notNull(),
  _event: text('event').notNull(),
  _payload: json('payload'),
  _createdAt: timestamp('created_at').defaultNow()
});

export const webhookDeliveries = pgTable('webhook_deliveries', {
  _id: serial('id').primaryKey(),
  _webhookId: integer('webhook_id').notNull(),
  _eventId: integer('event_id').notNull(),
  _status: text('status', { _enum: ['pending', 'success', 'failed', 'delivered', 'retrying'] }).default('pending'),
  _attempt: integer('attempt').default(1),
  _response: text('response'),
  _createdAt: timestamp('created_at').defaultNow(),
  _updatedAt: timestamp('updated_at').defaultNow()
});

// --- Compatibility type aliases for frontend ---
export type InsertProduct = z.infer<typeof insertProductSchema>;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertStore = z.infer<typeof insertStoreSchema>;
export type InsertInventory = z.infer<typeof insertInventorySchema>;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type InsertReturnReason = z.infer<typeof insertReturnReasonSchema>;
export type InsertLoyaltyTier = z.infer<typeof insertLoyaltyTierSchema>;
export type InsertLoyaltyReward = z.infer<typeof insertLoyaltyRewardSchema>;
export type InsertCustomer = z.infer<typeof customerInsertSchema>;
export type SubscriptionInsert = InsertSubscription; // Alias for compatibility

// Add missing type exports for test factories
export type CustomerInsert = InsertCustomer;
export type ProductInsert = InsertProduct;
export type StoreInsert = InsertStore;
export type UserInsert = InsertUser;
export type TransactionInsert = InsertTransaction;
export type InventoryInsert = InsertInventory;

export type SelectUser = typeof users.$inferSelect;
export type SelectStore = typeof stores.$inferSelect;
export type SelectProduct = typeof products.$inferSelect;
export type SelectInventory = typeof inventory.$inferSelect;
export type SelectTransaction = typeof transactions.$inferSelect;
export type SelectSubscription = typeof subscriptions.$inferSelect;
export type SelectLoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type SelectLoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type SelectLoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type SelectLoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type SelectLoyaltyReward = typeof loyaltyRewards.$inferSelect;
export type SelectCategory = typeof categories.$inferSelect;
export type SelectReturnReason = typeof returnReasons.$inferSelect;
export type SelectReturn = typeof returns.$inferSelect;
export type SelectCustomer = typeof customers.$inferSelect;
export type Inventory = typeof inventory.$inferSelect;
export type InventoryBatch = typeof inventoryBatches.$inferSelect;

// -----------------------------------------------------------------------------------------------
// Legacy PascalCase aliases so older services using schema.Inventory work at runtime
// -----------------------------------------------------------------------------------------------
export const Inventory = inventory;
export const InventoryBatch = inventoryBatches;
export const Transactions = transactions;
export const Returns = returns;
export const Customers = customers;
/* ------------------------------------------------------------------ */
/*  Affiliates                                                         */
/* ------------------------------------------------------------------ */

export const affiliates = pgTable('affiliates', {
  _id: serial('id').primaryKey(),
  _userId: integer('user_id').notNull().references(() => users.id),
  _code: text('code').notNull().unique(),
  _totalReferrals: integer('total_referrals').default(0),
  _totalEarnings: decimal('total_earnings',  { _precision: 12, _scale: 2 }).default('0'),
  _pendingEarnings: decimal('pending_earnings', { _precision: 12, _scale: 2 }).default('0'),

  /* optional payout / bank-detail fields */
  _bankName: text('bank_name'),
  _bankCode: text('bank_code'),
  _accountNumber: text('account_number'),
  _accountName: text('account_name'),
  _paymentMethod: text('payment_method', { _enum: ['paystack', 'flutterwave', 'manual'] }),

  _createdAt: timestamp('created_at').defaultNow(),
  _updatedAt: timestamp('updated_at').defaultNow()
});

/* Zod insert schema */
export const insertAffiliateSchema = createInsertSchema(affiliates).omit({
  _id: true,
  _createdAt: true,
  _updatedAt: true
});

/* Type aliases */
export type Affiliate       = typeof affiliates.$inferSelect;
export type AffiliateInsert = z.infer<typeof insertAffiliateSchema>;
/* ------------------------------------------------------------------ */

export const referrals = pgTable('referrals', {
  _id: serial('id').primaryKey(),
  _affiliateId: integer('affiliate_id').notNull().references(() => affiliates.id),
  _referredUserId: integer('referred_user_id').notNull().references(() => users.id),
  _status: text('status', { _enum: ['pending', 'active', 'expired'] }).default('pending'),
  _discountApplied: boolean('discount_applied').default(false),
  _commissionPaid: boolean('commission_paid').default(false),
  _signupDate: timestamp('signup_date').defaultNow(),
  _activationDate: timestamp('activation_date'),
  _expiryDate: timestamp('expiry_date'),
  _createdAt: timestamp('created_at').defaultNow(),
  _updatedAt: timestamp('updated_at').defaultNow()
});

export const insertReferralSchema = createInsertSchema(referrals).omit({
  _id: true,
  _createdAt: true,
  _updatedAt: true
});

export type Referral       = typeof referrals.$inferSelect;
export type ReferralInsert = z.infer<typeof insertReferralSchema>;

/* ------------------------------------------------------------------ */

export const referralPayments = pgTable('referral_payments', {
  _id: serial('id').primaryKey(),
  _affiliateId: integer('affiliate_id').notNull().references(() => affiliates.id),
  _amount: decimal('amount', { _precision: 12, _scale: 2 }).notNull(),
  _currency: text('currency').default('NGN'),
  _status: text('status', { _enum: ['pending', 'completed', 'failed'] }).default('pending'),
  _paymentMethod: text('payment_method', { _enum: ['paystack', 'flutterwave', 'manual'] }).default('paystack'),
  _transactionReference: text('transaction_reference'),
  _paymentDate: timestamp('payment_date'),
  _createdAt: timestamp('created_at').defaultNow(),
  _updatedAt: timestamp('updated_at').defaultNow()
});

export const insertReferralPaymentSchema = createInsertSchema(referralPayments).omit({
  _id: true,
  _createdAt: true,
  _updatedAt: true
});

export type ReferralPayment       = typeof referralPayments.$inferSelect;
export type ReferralPaymentInsert = z.infer<typeof insertReferralPaymentSchema>;
