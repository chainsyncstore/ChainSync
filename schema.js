'use strict';
Object.defineProperty(exports, '__esModule', { _value: true });
exports.insertReferralPaymentSchema = exports.referralPayments = exports.insertReferralSchema = exports.referrals = exports.insertAffiliateSchema = exports.affiliates = exports.Returns = exports.Transactions = exports.InventoryBatch = exports.Inventory = exports.webhookDeliveries = exports.webhookEvents = exports.webhooks = exports.inventoryTransactions = exports.inventoryItemsRelations = exports.inventoryItems = exports.inventoryBatches = exports.insertLoyaltyRewardSchema = exports.insertLoyaltyTierSchema = exports.insertReturnReasonSchema = exports.insertCategorySchema = exports.insertSubscriptionSchema = exports.insertTransactionSchema = exports.insertInventorySchema = exports.insertProductSchema = exports.insertStoreSchema = exports.insertUserSchema = exports.passwordResetTokens = exports.subscriptions = exports.transactionPayments = exports.transactionItems = exports.loyaltyRewards = exports.loyaltyTiers = exports.loyaltyTransactions = exports.loyaltyMembers = exports.loyaltyPrograms = exports.returnItems = exports.returns = exports.transactions = exports.inventory = exports.returnReasons = exports.categories = exports.products = exports.stores = exports.users = void 0;
const pg_core_1 = require('drizzle-orm/pg-core');
const drizzle_orm_1 = require('drizzle-orm');
const drizzle_zod_1 = require('drizzle-zod');
// Users table
exports.users = (0, pg_core_1.pgTable)('users', {
  _id: (0, pg_core_1.serial)('id').primaryKey(),
  _email: (0, pg_core_1.text)('email').notNull().unique(),
  _name: (0, pg_core_1.text)('name').notNull(),
  _password: (0, pg_core_1.text)('password').notNull(),
  _role: (0, pg_core_1.text)('role', { _enum: ['admin', 'manager', 'cashier'] }).default('cashier'),
  _storeId: (0, pg_core_1.integer)('store_id'),
  _isActive: (0, pg_core_1.boolean)('is_active').default(true),
  _createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
  _updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow()
});
// Stores table
exports.stores = (0, pg_core_1.pgTable)('stores', {
  _id: (0, pg_core_1.serial)('id').primaryKey(),
  _name: (0, pg_core_1.text)('name').notNull(),
  _location: (0, pg_core_1.text)('location').notNull(),
  _address: (0, pg_core_1.text)('address'),
  _city: (0, pg_core_1.text)('city'),
  _state: (0, pg_core_1.text)('state'),
  _country: (0, pg_core_1.text)('country'),
  _phone: (0, pg_core_1.text)('phone'),
  _email: (0, pg_core_1.text)('email'),
  _timezone: (0, pg_core_1.text)('timezone'),
  _status: (0, pg_core_1.text)('status').default('active'),
  _managerId: (0, pg_core_1.integer)('manager_id'),
  _isActive: (0, pg_core_1.boolean)('is_active').default(true),
  _createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
  _updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow()
});
// Products table
exports.products = (0, pg_core_1.pgTable)('products', {
  _id: (0, pg_core_1.serial)('id').primaryKey(),
  _name: (0, pg_core_1.text)('name').notNull(),
  _description: (0, pg_core_1.text)('description'),
  _barcode: (0, pg_core_1.text)('barcode').unique(),
  _price: (0, pg_core_1.decimal)('price', { _precision: 10, _scale: 2 }).notNull(),
  _cost: (0, pg_core_1.decimal)('cost', { _precision: 10, _scale: 2 }),
  _categoryId: (0, pg_core_1.integer)('category_id'),
  _brandId: (0, pg_core_1.integer)('brand_id'),
  _unit: (0, pg_core_1.text)('unit').default('pcs'),
  _isActive: (0, pg_core_1.boolean)('is_active').default(true),
  _isPerishable: (0, pg_core_1.boolean)('is_perishable').default(false),
  _createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
  _updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
  _storeId: (0, pg_core_1.integer)('store_id').notNull(),
  _imageUrl: (0, pg_core_1.text)('image_url'),
  _attributes: (0, pg_core_1.json)('attributes'),
  _sku: (0, pg_core_1.text)('sku').notNull()
});
// Categories table
exports.categories = (0, pg_core_1.pgTable)('categories', {
  _id: (0, pg_core_1.serial)('id').primaryKey(),
  _name: (0, pg_core_1.text)('name').notNull().unique(),
  _description: (0, pg_core_1.text)('description'),
  _isActive: (0, pg_core_1.boolean)('is_active').default(true),
  _createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
  _updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow()
});
// Return Reasons table
exports.returnReasons = (0, pg_core_1.pgTable)('return_reasons', {
  _id: (0, pg_core_1.serial)('id').primaryKey(),
  _reason: (0, pg_core_1.text)('reason').notNull(),
  _description: (0, pg_core_1.text)('description'),
  _isActive: (0, pg_core_1.boolean)('is_active').default(true),
  _createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow()
});
// Inventory table
exports.inventory = (0, pg_core_1.pgTable)('inventory', {
  _id: (0, pg_core_1.serial)('id').primaryKey(),
  _productId: (0, pg_core_1.integer)('product_id').notNull(),
  _storeId: (0, pg_core_1.integer)('store_id').notNull(),
  _quantity: (0, pg_core_1.integer)('quantity').default(0),
  _minStock: (0, pg_core_1.integer)('min_stock').default(0),
  _maxStock: (0, pg_core_1.integer)('max_stock'),
  _lastRestocked: (0, pg_core_1.timestamp)('last_restocked'),
  _updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
  _batchTracking: (0, pg_core_1.boolean)('batch_tracking').default(false),
  _currentUtilization: (0, pg_core_1.integer)('current_utilization').default(0),
  // Aliases expected by legacy services ----------------------------------------------------------
  _totalQuantity: (0, pg_core_1.integer)('total_quantity').default(0),
  _availableQuantity: (0, pg_core_1.integer)('available_quantity').default(0),
  _minimumLevel: (0, pg_core_1.integer)('minimum_level').default(0)
});
// Transactions table
exports.transactions = (0, pg_core_1.pgTable)('transactions', {
  _id: (0, pg_core_1.serial)('id').primaryKey(),
  _storeId: (0, pg_core_1.integer)('store_id').notNull(),
  _userId: (0, pg_core_1.integer)('user_id').notNull(),
  _customerId: (0, pg_core_1.integer)('customer_id'),
  _total: (0, pg_core_1.decimal)('total', { _precision: 10, _scale: 2 }).notNull(),
  _subtotal: (0, pg_core_1.decimal)('subtotal', { _precision: 10, _scale: 2 }).notNull(),
  _tax: (0, pg_core_1.decimal)('tax', { _precision: 10, _scale: 2 }).default('0'),
  _discount: (0, pg_core_1.decimal)('discount', { _precision: 10, _scale: 2 }).default('0'),
  _paymentMethod: (0, pg_core_1.text)('payment_method', { _enum: ['cash', 'card', 'mobile'] }).notNull(),
  _status: (0, pg_core_1.text)('status', { _enum: ['pending', 'completed', 'cancelled'] }).default('pending'),
  _items: (0, pg_core_1.json)('items'), // Store transaction items as JSON
  _createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow()
});
// Returns table
exports.returns = (0, pg_core_1.pgTable)('returns', {
  _id: (0, pg_core_1.serial)('id').primaryKey(),
  _refundId: (0, pg_core_1.text)('refund_id').notNull(),
  _total: (0, pg_core_1.decimal)('total', { _precision: 10, _scale: 2 }).notNull(),
  _refundMethod: (0, pg_core_1.text)('refund_method', { _enum: ['cash', 'credit_card', 'store_credit'] }).default('cash'),
  _status: (0, pg_core_1.text)('status', { _enum: ['pending', 'processed'] }).default('pending'),
  _createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
  _updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow()
});
// Return Items table
exports.returnItems = (0, pg_core_1.pgTable)('return_items', {
  _id: (0, pg_core_1.serial)('id').primaryKey(),
  _returnId: (0, pg_core_1.integer)('return_id').notNull(),
  _productId: (0, pg_core_1.integer)('product_id').notNull(),
  _quantity: (0, pg_core_1.integer)('quantity').notNull(),
  _unitPrice: (0, pg_core_1.decimal)('unit_price', { _precision: 10, _scale: 2 }).notNull()
});
// Loyalty Programs table
exports.loyaltyPrograms = (0, pg_core_1.pgTable)('loyalty_programs', {
  _id: (0, pg_core_1.serial)('id').primaryKey(),
  _name: (0, pg_core_1.text)('name').notNull(),
  _description: (0, pg_core_1.text)('description'),
  _createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
  _updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
  _storeId: (0, pg_core_1.integer)('store_id').notNull(),
  _active: (0, pg_core_1.boolean)('active').default(true)
});
// Loyalty Members table
exports.loyaltyMembers = (0, pg_core_1.pgTable)('loyalty_members', {
  _id: (0, pg_core_1.serial)('id').primaryKey(),
  _userId: (0, pg_core_1.integer)('user_id').notNull(),
  _loyaltyId: (0, pg_core_1.text)('loyalty_id').notNull(),
  _currentPoints: (0, pg_core_1.decimal)('current_points', { _precision: 10, _scale: 2 }).default('0'),
  _createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
  _updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
  _programId: (0, pg_core_1.integer)('program_id').notNull(),
  _customerId: (0, pg_core_1.integer)('customer_id').notNull(),
  _points: (0, pg_core_1.integer)('points').default(0)
});
// Loyalty Transactions table
exports.loyaltyTransactions = (0, pg_core_1.pgTable)('loyalty_transactions', {
  _id: (0, pg_core_1.serial)('id').primaryKey(),
  _memberId: (0, pg_core_1.integer)('member_id').notNull(),
  _programId: (0, pg_core_1.integer)('program_id').notNull(),
  _pointsEarned: (0, pg_core_1.integer)('points_earned').default(0),
  _pointsRedeemed: (0, pg_core_1.integer)('points_redeemed').default(0),
  _pointsBalance: (0, pg_core_1.integer)('points_balance').notNull(),
  _transactionType: (0, pg_core_1.text)('transaction_type', { _enum: ['earn', 'redeem'] }).notNull(),
  _source: (0, pg_core_1.text)('source').notNull(),
  _transactionId: (0, pg_core_1.integer)('transaction_id'),
  _description: (0, pg_core_1.text)('description'),
  _createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow()
});
// Loyalty Tiers table
exports.loyaltyTiers = (0, pg_core_1.pgTable)('loyalty_tiers', {
  _id: (0, pg_core_1.serial)('id').primaryKey(),
  _programId: (0, pg_core_1.integer)('program_id').notNull(),
  _name: (0, pg_core_1.text)('name').notNull(),
  _requiredPoints: (0, pg_core_1.integer)('required_points').notNull(),
  _multiplier: (0, pg_core_1.decimal)('multiplier', { _precision: 5, _scale: 2 }).default('1.00'),
  _active: (0, pg_core_1.boolean)('active').default(true)
});
// Loyalty Rewards table
exports.loyaltyRewards = (0, pg_core_1.pgTable)('loyalty_rewards', {
  _id: (0, pg_core_1.serial)('id').primaryKey(),
  _programId: (0, pg_core_1.integer)('program_id').notNull(),
  _name: (0, pg_core_1.text)('name').notNull(),
  _description: (0, pg_core_1.text)('description'),
  _pointsRequired: (0, pg_core_1.integer)('points_required').notNull(),
  _active: (0, pg_core_1.boolean)('active').default(true)
});
// Transaction Items table
exports.transactionItems = (0, pg_core_1.pgTable)('transaction_items', {
  _id: (0, pg_core_1.serial)('id').primaryKey(),
  _transactionId: (0, pg_core_1.integer)('transaction_id').notNull(),
  _productId: (0, pg_core_1.integer)('product_id').notNull(),
  _quantity: (0, pg_core_1.integer)('quantity').notNull(),
  _unitPrice: (0, pg_core_1.decimal)('unit_price', { _precision: 10, _scale: 2 }).notNull()
});
// Transaction Payments table
exports.transactionPayments = (0, pg_core_1.pgTable)('transaction_payments', {
  _id: (0, pg_core_1.serial)('id').primaryKey(),
  _transactionId: (0, pg_core_1.integer)('transaction_id').notNull(),
  _amount: (0, pg_core_1.decimal)('amount', { _precision: 10, _scale: 2 }).notNull(),
  _method: (0, pg_core_1.text)('method', { _enum: ['cash', 'card', 'mobile'] }).notNull()
});
// Subscriptions table
exports.subscriptions = (0, pg_core_1.pgTable)('subscriptions', {
  _id: (0, pg_core_1.serial)('id').primaryKey(),
  _userId: (0, pg_core_1.integer)('user_id').notNull(),
  _planId: (0, pg_core_1.text)('plan_id').notNull(),
  _status: (0, pg_core_1.text)('status', { _enum: ['active', 'cancelled', 'expired'] }).default('active'),
  _currentPeriodStart: (0, pg_core_1.timestamp)('current_period_start'),
  _currentPeriodEnd: (0, pg_core_1.timestamp)('current_period_end'),
  _endDate: (0, pg_core_1.timestamp)('end_date'),
  _metadata: (0, pg_core_1.json)('metadata'),
  _paymentMethod: (0, pg_core_1.text)('payment_method'),
  _amount: (0, pg_core_1.decimal)('amount', { _precision: 10, _scale: 2 }),
  _currency: (0, pg_core_1.text)('currency').default('USD'),
  _referralCode: (0, pg_core_1.text)('referral_code'),
  _autoRenew: (0, pg_core_1.boolean)('auto_renew').default(true),
  _createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
  _updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow()
});
// Password Reset Tokens table
exports.passwordResetTokens = (0, pg_core_1.pgTable)('password_reset_tokens', {
  _id: (0, pg_core_1.serial)('id').primaryKey(),
  _userId: (0, pg_core_1.integer)('user_id').notNull(),
  _token: (0, pg_core_1.text)('token').notNull(),
  _expiresAt: (0, pg_core_1.timestamp)('expires_at').notNull()
});
// Zod schemas for validation
exports.insertUserSchema = (0, drizzle_zod_1.createInsertSchema)(exports.users).omit({
  _id: true,
  _createdAt: true,
  _updatedAt: true
});
exports.insertStoreSchema = (0, drizzle_zod_1.createInsertSchema)(exports.stores).omit({
  _id: true,
  _createdAt: true,
  _updatedAt: true
});
exports.insertProductSchema = (0, drizzle_zod_1.createInsertSchema)(exports.products).omit({
  _id: true,
  _createdAt: true,
  _updatedAt: true
});
exports.insertInventorySchema = (0, drizzle_zod_1.createInsertSchema)(exports.inventory).omit({
  _id: true,
  _updatedAt: true
});
exports.insertTransactionSchema = (0, drizzle_zod_1.createInsertSchema)(exports.transactions).omit({
  _id: true,
  _createdAt: true
});
exports.insertSubscriptionSchema = (0, drizzle_zod_1.createInsertSchema)(exports.subscriptions).omit({
  _id: true,
  _createdAt: true,
  _updatedAt: true
});
exports.insertCategorySchema = (0, drizzle_zod_1.createInsertSchema)(exports.categories).omit({
  _id: true,
  _createdAt: true,
  _updatedAt: true
});
exports.insertReturnReasonSchema = (0, drizzle_zod_1.createInsertSchema)(exports.returnReasons).omit({
  _id: true,
  _createdAt: true
});
exports.insertLoyaltyTierSchema = (0, drizzle_zod_1.createInsertSchema)(exports.loyaltyTiers).omit({
  _id: true
});
exports.insertLoyaltyRewardSchema = (0, drizzle_zod_1.createInsertSchema)(exports.loyaltyRewards).omit({
  _id: true
});
exports.inventoryBatches = (0, pg_core_1.pgTable)('inventory_batches', {
  _id: (0, pg_core_1.serial)('id').primaryKey(),
  _inventoryId: (0, pg_core_1.integer)('inventory_id').notNull(),
  _batchNumber: (0, pg_core_1.text)('batch_number'),
  _expiryDate: (0, pg_core_1.timestamp)('expiry_date'),
  _quantity: (0, pg_core_1.integer)('quantity').notNull(),
  _receivedDate: (0, pg_core_1.timestamp)('received_date'),
  _manufacturingDate: (0, pg_core_1.timestamp)('manufacturing_date'),
  _costPerUnit: (0, pg_core_1.decimal)('cost_per_unit', { _precision: 10, _scale: 2 }),
  _createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
  _updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow()
});
exports.inventoryItems = (0, pg_core_1.pgTable)('inventory_items', {
  _id: (0, pg_core_1.serial)('id').primaryKey(),
  _inventoryId: (0, pg_core_1.integer)('inventory_id').notNull(),
  _productId: (0, pg_core_1.integer)('product_id').notNull().references(() => exports.products.id),
  _quantity: (0, pg_core_1.integer)('quantity').notNull(),
  _sku: (0, pg_core_1.text)('sku'),
  _createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
  _updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
  _metadata: (0, pg_core_1.json)('metadata'),
  _receivedDate: (0, pg_core_1.timestamp)('received_date'),
  _reorderLevel: (0, pg_core_1.integer)('reorder_level'),
  _reorderQuantity: (0, pg_core_1.integer)('reorder_quantity')
});
exports.inventoryItemsRelations = (0, drizzle_orm_1.relations)(exports.inventoryItems, ({ one }) => ({
  _product: one(exports.products, {
    _fields: [exports.inventoryItems.productId],
    _references: [exports.products.id]
  })
}));
exports.inventoryTransactions = (0, pg_core_1.pgTable)('inventory_transactions', {
  _id: (0, pg_core_1.serial)('id').primaryKey(),
  _inventoryId: (0, pg_core_1.integer)('inventory_id').notNull(),
  _itemId: (0, pg_core_1.integer)('item_id'),
  _quantity: (0, pg_core_1.integer)('quantity').notNull(),
  _type: (0, pg_core_1.text)('type', { _enum: ['in', 'out'] }).notNull(),
  _createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow()
});
exports.webhooks = (0, pg_core_1.pgTable)('webhooks', {
  _id: (0, pg_core_1.serial)('id').primaryKey(),
  _url: (0, pg_core_1.text)('url').notNull(),
  _secret: (0, pg_core_1.text)('secret'),
  _events: (0, pg_core_1.json)('events'),
  _isActive: (0, pg_core_1.boolean)('is_active').default(true),
  _createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
  _updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
  _storeId: (0, pg_core_1.integer)('store_id').notNull()
});
exports.webhookEvents = (0, pg_core_1.pgTable)('webhook_events', {
  _id: (0, pg_core_1.serial)('id').primaryKey(),
  _webhookId: (0, pg_core_1.integer)('webhook_id').notNull(),
  _event: (0, pg_core_1.text)('event').notNull(),
  _payload: (0, pg_core_1.json)('payload'),
  _createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow()
});
exports.webhookDeliveries = (0, pg_core_1.pgTable)('webhook_deliveries', {
  _id: (0, pg_core_1.serial)('id').primaryKey(),
  _webhookId: (0, pg_core_1.integer)('webhook_id').notNull(),
  _eventId: (0, pg_core_1.integer)('event_id').notNull(),
  _status: (0, pg_core_1.text)('status', { _enum: ['pending', 'success', 'failed', 'delivered', 'retrying'] }).default('pending'),
  _attempt: (0, pg_core_1.integer)('attempt').default(1),
  _response: (0, pg_core_1.text)('response'),
  _createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
  _updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow()
});
// -----------------------------------------------------------------------------------------------
// Legacy PascalCase aliases so older services using schema.Inventory work at runtime
// -----------------------------------------------------------------------------------------------
exports.Inventory = exports.inventory;
exports.InventoryBatch = exports.inventoryBatches;
exports.Transactions = exports.transactions;
exports.Returns = exports.returns;
/* ------------------------------------------------------------------ */
/*  Affiliates                                                         */
/* ------------------------------------------------------------------ */
exports.affiliates = (0, pg_core_1.pgTable)('affiliates', {
  _id: (0, pg_core_1.serial)('id').primaryKey(),
  _userId: (0, pg_core_1.integer)('user_id').notNull().references(() => exports.users.id),
  _code: (0, pg_core_1.text)('code').notNull().unique(),
  _totalReferrals: (0, pg_core_1.integer)('total_referrals').default(0),
  _totalEarnings: (0, pg_core_1.decimal)('total_earnings', { _precision: 12, _scale: 2 }).default('0'),
  _pendingEarnings: (0, pg_core_1.decimal)('pending_earnings', { _precision: 12, _scale: 2 }).default('0'),
  /* optional payout / bank-detail fields */
  _bankName: (0, pg_core_1.text)('bank_name'),
  _bankCode: (0, pg_core_1.text)('bank_code'),
  _accountNumber: (0, pg_core_1.text)('account_number'),
  _accountName: (0, pg_core_1.text)('account_name'),
  _paymentMethod: (0, pg_core_1.text)('payment_method', { _enum: ['paystack', 'flutterwave', 'manual'] }),
  _createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
  _updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow()
});
/* Zod insert schema */
exports.insertAffiliateSchema = (0, drizzle_zod_1.createInsertSchema)(exports.affiliates).omit({
  _id: true,
  _createdAt: true,
  _updatedAt: true
});
/* ------------------------------------------------------------------ */
exports.referrals = (0, pg_core_1.pgTable)('referrals', {
  _id: (0, pg_core_1.serial)('id').primaryKey(),
  _affiliateId: (0, pg_core_1.integer)('affiliate_id').notNull().references(() => exports.affiliates.id),
  _referredUserId: (0, pg_core_1.integer)('referred_user_id').notNull().references(()
   = > exports.users.id),
  _status: (0, pg_core_1.text)('status', { _enum: ['pending', 'active', 'expired'] }).default('pending'),
  _discountApplied: (0, pg_core_1.boolean)('discount_applied').default(false),
  _commissionPaid: (0, pg_core_1.boolean)('commission_paid').default(false),
  _signupDate: (0, pg_core_1.timestamp)('signup_date').defaultNow(),
  _activationDate: (0, pg_core_1.timestamp)('activation_date'),
  _expiryDate: (0, pg_core_1.timestamp)('expiry_date'),
  _createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
  _updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow()
});
exports.insertReferralSchema = (0, drizzle_zod_1.createInsertSchema)(exports.referrals).omit({
  _id: true,
  _createdAt: true,
  _updatedAt: true
});
/* ------------------------------------------------------------------ */
exports.referralPayments = (0, pg_core_1.pgTable)('referral_payments', {
  _id: (0, pg_core_1.serial)('id').primaryKey(),
  _affiliateId: (0, pg_core_1.integer)('affiliate_id').notNull().references(() => exports.affiliates.id),
  _amount: (0, pg_core_1.decimal)('amount', { _precision: 12, _scale: 2 }).notNull(),
  _currency: (0, pg_core_1.text)('currency').default('NGN'),
  _status: (0, pg_core_1.text)('status', { _enum: ['pending', 'completed', 'failed'] }).default('pending'),
  _paymentMethod: (0, pg_core_1.text)('payment_method', { _enum: ['paystack', 'flutterwave', 'manual'] }).default('paystack'),
  _transactionReference: (0, pg_core_1.text)('transaction_reference'),
  _paymentDate: (0, pg_core_1.timestamp)('payment_date'),
  _createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
  _updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow()
});
exports.insertReferralPaymentSchema = (0, drizzle_zod_1.createInsertSchema)(exports.referralPayments).omit({
  _id: true,
  _createdAt: true,
  _updatedAt: true
});
