"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertReferralPaymentSchema = exports.referralPayments = exports.insertReferralSchema = exports.referrals = exports.insertAffiliateSchema = exports.affiliates = exports.Returns = exports.Transactions = exports.InventoryBatch = exports.Inventory = exports.webhookDeliveries = exports.webhookEvents = exports.webhooks = exports.inventoryTransactions = exports.inventoryItemsRelations = exports.inventoryItems = exports.inventoryBatches = exports.insertLoyaltyRewardSchema = exports.insertLoyaltyTierSchema = exports.insertReturnReasonSchema = exports.insertCategorySchema = exports.insertSubscriptionSchema = exports.insertTransactionSchema = exports.insertInventorySchema = exports.insertProductSchema = exports.insertStoreSchema = exports.insertUserSchema = exports.passwordResetTokens = exports.subscriptions = exports.transactionPayments = exports.transactionItems = exports.loyaltyRewards = exports.loyaltyTiers = exports.loyaltyTransactions = exports.loyaltyMembers = exports.loyaltyPrograms = exports.returnItems = exports.returns = exports.transactions = exports.inventory = exports.returnReasons = exports.categories = exports.products = exports.stores = exports.users = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
const drizzle_zod_1 = require("drizzle-zod");
// Users table
exports.users = (0, pg_core_1.pgTable)('users', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    email: (0, pg_core_1.text)('email').notNull().unique(),
    name: (0, pg_core_1.text)('name').notNull(),
    password: (0, pg_core_1.text)('password').notNull(),
    role: (0, pg_core_1.text)('role', { enum: ['admin', 'manager', 'cashier'] }).default('cashier'),
    storeId: (0, pg_core_1.integer)('store_id'),
    isActive: (0, pg_core_1.boolean)('is_active').default(true),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
});
// Stores table
exports.stores = (0, pg_core_1.pgTable)('stores', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    name: (0, pg_core_1.text)('name').notNull(),
    location: (0, pg_core_1.text)('location').notNull(),
    address: (0, pg_core_1.text)('address'),
    city: (0, pg_core_1.text)('city'),
    state: (0, pg_core_1.text)('state'),
    country: (0, pg_core_1.text)('country'),
    phone: (0, pg_core_1.text)('phone'),
    email: (0, pg_core_1.text)('email'),
    timezone: (0, pg_core_1.text)('timezone'),
    status: (0, pg_core_1.text)('status').default('active'),
    managerId: (0, pg_core_1.integer)('manager_id'),
    isActive: (0, pg_core_1.boolean)('is_active').default(true),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
});
// Products table
exports.products = (0, pg_core_1.pgTable)('products', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    name: (0, pg_core_1.text)('name').notNull(),
    description: (0, pg_core_1.text)('description'),
    barcode: (0, pg_core_1.text)('barcode').unique(),
    price: (0, pg_core_1.decimal)('price', { precision: 10, scale: 2 }).notNull(),
    cost: (0, pg_core_1.decimal)('cost', { precision: 10, scale: 2 }),
    categoryId: (0, pg_core_1.integer)('category_id'),
    brandId: (0, pg_core_1.integer)('brand_id'),
    unit: (0, pg_core_1.text)('unit').default('pcs'),
    isActive: (0, pg_core_1.boolean)('is_active').default(true),
    isPerishable: (0, pg_core_1.boolean)('is_perishable').default(false),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
    storeId: (0, pg_core_1.integer)('store_id').notNull(),
    imageUrl: (0, pg_core_1.text)('image_url'),
    attributes: (0, pg_core_1.json)('attributes'),
    sku: (0, pg_core_1.text)('sku').notNull(),
});
// Categories table
exports.categories = (0, pg_core_1.pgTable)('categories', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    name: (0, pg_core_1.text)('name').notNull().unique(),
    description: (0, pg_core_1.text)('description'),
    isActive: (0, pg_core_1.boolean)('is_active').default(true),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
});
// Return Reasons table
exports.returnReasons = (0, pg_core_1.pgTable)('return_reasons', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    reason: (0, pg_core_1.text)('reason').notNull(),
    description: (0, pg_core_1.text)('description'),
    isActive: (0, pg_core_1.boolean)('is_active').default(true),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
});
// Inventory table
exports.inventory = (0, pg_core_1.pgTable)('inventory', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    productId: (0, pg_core_1.integer)('product_id').notNull(),
    storeId: (0, pg_core_1.integer)('store_id').notNull(),
    quantity: (0, pg_core_1.integer)('quantity').default(0),
    minStock: (0, pg_core_1.integer)('min_stock').default(0),
    maxStock: (0, pg_core_1.integer)('max_stock'),
    lastRestocked: (0, pg_core_1.timestamp)('last_restocked'),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
    batchTracking: (0, pg_core_1.boolean)('batch_tracking').default(false),
    currentUtilization: (0, pg_core_1.integer)('current_utilization').default(0),
    // Aliases expected by legacy services ----------------------------------------------------------
    totalQuantity: (0, pg_core_1.integer)('total_quantity').default(0),
    availableQuantity: (0, pg_core_1.integer)('available_quantity').default(0),
    minimumLevel: (0, pg_core_1.integer)('minimum_level').default(0),
});
// Transactions table
exports.transactions = (0, pg_core_1.pgTable)('transactions', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    storeId: (0, pg_core_1.integer)('store_id').notNull(),
    userId: (0, pg_core_1.integer)('user_id').notNull(),
    customerId: (0, pg_core_1.integer)('customer_id'),
    total: (0, pg_core_1.decimal)('total', { precision: 10, scale: 2 }).notNull(),
    subtotal: (0, pg_core_1.decimal)('subtotal', { precision: 10, scale: 2 }).notNull(),
    tax: (0, pg_core_1.decimal)('tax', { precision: 10, scale: 2 }).default('0'),
    discount: (0, pg_core_1.decimal)('discount', { precision: 10, scale: 2 }).default('0'),
    paymentMethod: (0, pg_core_1.text)('payment_method', { enum: ['cash', 'card', 'mobile'] }).notNull(),
    status: (0, pg_core_1.text)('status', { enum: ['pending', 'completed', 'cancelled'] }).default('pending'),
    items: (0, pg_core_1.json)('items'), // Store transaction items as JSON
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
});
// Returns table
exports.returns = (0, pg_core_1.pgTable)('returns', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    refundId: (0, pg_core_1.text)('refund_id').notNull(),
    total: (0, pg_core_1.decimal)('total', { precision: 10, scale: 2 }).notNull(),
    refundMethod: (0, pg_core_1.text)('refund_method', { enum: ['cash', 'credit_card', 'store_credit'] }).default('cash'),
    status: (0, pg_core_1.text)('status', { enum: ['pending', 'processed'] }).default('pending'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
});
// Return Items table
exports.returnItems = (0, pg_core_1.pgTable)('return_items', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    returnId: (0, pg_core_1.integer)('return_id').notNull(),
    productId: (0, pg_core_1.integer)('product_id').notNull(),
    quantity: (0, pg_core_1.integer)('quantity').notNull(),
    unitPrice: (0, pg_core_1.decimal)('unit_price', { precision: 10, scale: 2 }).notNull(),
});
// Loyalty Programs table
exports.loyaltyPrograms = (0, pg_core_1.pgTable)('loyalty_programs', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    name: (0, pg_core_1.text)('name').notNull(),
    description: (0, pg_core_1.text)('description'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
    storeId: (0, pg_core_1.integer)('store_id').notNull(),
    active: (0, pg_core_1.boolean)('active').default(true),
});
// Loyalty Members table
exports.loyaltyMembers = (0, pg_core_1.pgTable)('loyalty_members', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    userId: (0, pg_core_1.integer)('user_id').notNull(),
    loyaltyId: (0, pg_core_1.text)('loyalty_id').notNull(),
    currentPoints: (0, pg_core_1.decimal)('current_points', { precision: 10, scale: 2 }).default('0'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
    programId: (0, pg_core_1.integer)('program_id').notNull(),
    customerId: (0, pg_core_1.integer)('customer_id').notNull(),
    points: (0, pg_core_1.integer)('points').default(0),
});
// Loyalty Transactions table
exports.loyaltyTransactions = (0, pg_core_1.pgTable)('loyalty_transactions', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    memberId: (0, pg_core_1.integer)('member_id').notNull(),
    programId: (0, pg_core_1.integer)('program_id').notNull(),
    pointsEarned: (0, pg_core_1.integer)('points_earned').default(0),
    pointsRedeemed: (0, pg_core_1.integer)('points_redeemed').default(0),
    pointsBalance: (0, pg_core_1.integer)('points_balance').notNull(),
    transactionType: (0, pg_core_1.text)('transaction_type', { enum: ['earn', 'redeem'] }).notNull(),
    source: (0, pg_core_1.text)('source').notNull(),
    transactionId: (0, pg_core_1.integer)('transaction_id'),
    description: (0, pg_core_1.text)('description'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
});
// Loyalty Tiers table
exports.loyaltyTiers = (0, pg_core_1.pgTable)('loyalty_tiers', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    programId: (0, pg_core_1.integer)('program_id').notNull(),
    name: (0, pg_core_1.text)('name').notNull(),
    requiredPoints: (0, pg_core_1.integer)('required_points').notNull(),
    multiplier: (0, pg_core_1.decimal)('multiplier', { precision: 5, scale: 2 }).default('1.00'),
    active: (0, pg_core_1.boolean)('active').default(true),
});
// Loyalty Rewards table
exports.loyaltyRewards = (0, pg_core_1.pgTable)('loyalty_rewards', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    programId: (0, pg_core_1.integer)('program_id').notNull(),
    name: (0, pg_core_1.text)('name').notNull(),
    description: (0, pg_core_1.text)('description'),
    pointsRequired: (0, pg_core_1.integer)('points_required').notNull(),
    active: (0, pg_core_1.boolean)('active').default(true),
});
// Transaction Items table
exports.transactionItems = (0, pg_core_1.pgTable)('transaction_items', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    transactionId: (0, pg_core_1.integer)('transaction_id').notNull(),
    productId: (0, pg_core_1.integer)('product_id').notNull(),
    quantity: (0, pg_core_1.integer)('quantity').notNull(),
    unitPrice: (0, pg_core_1.decimal)('unit_price', { precision: 10, scale: 2 }).notNull(),
});
// Transaction Payments table
exports.transactionPayments = (0, pg_core_1.pgTable)('transaction_payments', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    transactionId: (0, pg_core_1.integer)('transaction_id').notNull(),
    amount: (0, pg_core_1.decimal)('amount', { precision: 10, scale: 2 }).notNull(),
    method: (0, pg_core_1.text)('method', { enum: ['cash', 'card', 'mobile'] }).notNull(),
});
// Subscriptions table
exports.subscriptions = (0, pg_core_1.pgTable)('subscriptions', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    userId: (0, pg_core_1.integer)('user_id').notNull(),
    planId: (0, pg_core_1.text)('plan_id').notNull(),
    status: (0, pg_core_1.text)('status', { enum: ['active', 'cancelled', 'expired'] }).default('active'),
    currentPeriodStart: (0, pg_core_1.timestamp)('current_period_start'),
    currentPeriodEnd: (0, pg_core_1.timestamp)('current_period_end'),
    endDate: (0, pg_core_1.timestamp)('end_date'),
    metadata: (0, pg_core_1.json)('metadata'),
    paymentMethod: (0, pg_core_1.text)('payment_method'),
    amount: (0, pg_core_1.decimal)('amount', { precision: 10, scale: 2 }),
    currency: (0, pg_core_1.text)('currency').default('USD'),
    referralCode: (0, pg_core_1.text)('referral_code'),
    autoRenew: (0, pg_core_1.boolean)('auto_renew').default(true),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
});
// Password Reset Tokens table
exports.passwordResetTokens = (0, pg_core_1.pgTable)('password_reset_tokens', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    userId: (0, pg_core_1.integer)('user_id').notNull(),
    token: (0, pg_core_1.text)('token').notNull(),
    expiresAt: (0, pg_core_1.timestamp)('expires_at').notNull(),
});
// Zod schemas for validation
exports.insertUserSchema = (0, drizzle_zod_1.createInsertSchema)(exports.users).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
exports.insertStoreSchema = (0, drizzle_zod_1.createInsertSchema)(exports.stores).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
exports.insertProductSchema = (0, drizzle_zod_1.createInsertSchema)(exports.products).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
exports.insertInventorySchema = (0, drizzle_zod_1.createInsertSchema)(exports.inventory).omit({
    id: true,
    updatedAt: true,
});
exports.insertTransactionSchema = (0, drizzle_zod_1.createInsertSchema)(exports.transactions).omit({
    id: true,
    createdAt: true,
});
exports.insertSubscriptionSchema = (0, drizzle_zod_1.createInsertSchema)(exports.subscriptions).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
exports.insertCategorySchema = (0, drizzle_zod_1.createInsertSchema)(exports.categories).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
exports.insertReturnReasonSchema = (0, drizzle_zod_1.createInsertSchema)(exports.returnReasons).omit({
    id: true,
    createdAt: true,
});
exports.insertLoyaltyTierSchema = (0, drizzle_zod_1.createInsertSchema)(exports.loyaltyTiers).omit({
    id: true,
});
exports.insertLoyaltyRewardSchema = (0, drizzle_zod_1.createInsertSchema)(exports.loyaltyRewards).omit({
    id: true,
});
exports.inventoryBatches = (0, pg_core_1.pgTable)('inventory_batches', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    inventoryId: (0, pg_core_1.integer)('inventory_id').notNull(),
    batchNumber: (0, pg_core_1.text)('batch_number'),
    expiryDate: (0, pg_core_1.timestamp)('expiry_date'),
    quantity: (0, pg_core_1.integer)('quantity').notNull(),
    receivedDate: (0, pg_core_1.timestamp)('received_date'),
    manufacturingDate: (0, pg_core_1.timestamp)('manufacturing_date'),
    costPerUnit: (0, pg_core_1.decimal)('cost_per_unit', { precision: 10, scale: 2 }),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
});
exports.inventoryItems = (0, pg_core_1.pgTable)('inventory_items', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    inventoryId: (0, pg_core_1.integer)('inventory_id').notNull(),
    productId: (0, pg_core_1.integer)('product_id').notNull().references(() => exports.products.id),
    quantity: (0, pg_core_1.integer)('quantity').notNull(),
    sku: (0, pg_core_1.text)('sku'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
    metadata: (0, pg_core_1.json)('metadata'),
    receivedDate: (0, pg_core_1.timestamp)('received_date'),
    reorderLevel: (0, pg_core_1.integer)('reorder_level'),
    reorderQuantity: (0, pg_core_1.integer)('reorder_quantity'),
});
exports.inventoryItemsRelations = (0, drizzle_orm_1.relations)(exports.inventoryItems, ({ one }) => ({
    product: one(exports.products, {
        fields: [exports.inventoryItems.productId],
        references: [exports.products.id],
    }),
}));
exports.inventoryTransactions = (0, pg_core_1.pgTable)('inventory_transactions', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    inventoryId: (0, pg_core_1.integer)('inventory_id').notNull(),
    itemId: (0, pg_core_1.integer)('item_id'),
    quantity: (0, pg_core_1.integer)('quantity').notNull(),
    type: (0, pg_core_1.text)('type', { enum: ['in', 'out'] }).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
});
exports.webhooks = (0, pg_core_1.pgTable)('webhooks', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    url: (0, pg_core_1.text)('url').notNull(),
    secret: (0, pg_core_1.text)('secret'),
    events: (0, pg_core_1.json)('events'),
    isActive: (0, pg_core_1.boolean)('is_active').default(true),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
    storeId: (0, pg_core_1.integer)('store_id').notNull(),
});
exports.webhookEvents = (0, pg_core_1.pgTable)('webhook_events', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    webhookId: (0, pg_core_1.integer)('webhook_id').notNull(),
    event: (0, pg_core_1.text)('event').notNull(),
    payload: (0, pg_core_1.json)('payload'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
});
exports.webhookDeliveries = (0, pg_core_1.pgTable)('webhook_deliveries', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    webhookId: (0, pg_core_1.integer)('webhook_id').notNull(),
    eventId: (0, pg_core_1.integer)('event_id').notNull(),
    status: (0, pg_core_1.text)('status', { enum: ['pending', 'success', 'failed', 'delivered', 'retrying'] }).default('pending'),
    attempt: (0, pg_core_1.integer)('attempt').default(1),
    response: (0, pg_core_1.text)('response'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
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
    id: (0, pg_core_1.serial)('id').primaryKey(),
    userId: (0, pg_core_1.integer)('user_id').notNull().references(() => exports.users.id),
    code: (0, pg_core_1.text)('code').notNull().unique(),
    totalReferrals: (0, pg_core_1.integer)('total_referrals').default(0),
    totalEarnings: (0, pg_core_1.decimal)('total_earnings', { precision: 12, scale: 2 }).default('0'),
    pendingEarnings: (0, pg_core_1.decimal)('pending_earnings', { precision: 12, scale: 2 }).default('0'),
    /* optional payout / bank-detail fields */
    bankName: (0, pg_core_1.text)('bank_name'),
    bankCode: (0, pg_core_1.text)('bank_code'),
    accountNumber: (0, pg_core_1.text)('account_number'),
    accountName: (0, pg_core_1.text)('account_name'),
    paymentMethod: (0, pg_core_1.text)('payment_method', { enum: ['paystack', 'flutterwave', 'manual'] }),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
});
/* Zod insert schema */
exports.insertAffiliateSchema = (0, drizzle_zod_1.createInsertSchema)(exports.affiliates).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
/* ------------------------------------------------------------------ */
exports.referrals = (0, pg_core_1.pgTable)('referrals', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    affiliateId: (0, pg_core_1.integer)('affiliate_id').notNull().references(() => exports.affiliates.id),
    referredUserId: (0, pg_core_1.integer)('referred_user_id').notNull().references(() => exports.users.id),
    status: (0, pg_core_1.text)('status', { enum: ['pending', 'active', 'expired'] }).default('pending'),
    discountApplied: (0, pg_core_1.boolean)('discount_applied').default(false),
    commissionPaid: (0, pg_core_1.boolean)('commission_paid').default(false),
    signupDate: (0, pg_core_1.timestamp)('signup_date').defaultNow(),
    activationDate: (0, pg_core_1.timestamp)('activation_date'),
    expiryDate: (0, pg_core_1.timestamp)('expiry_date'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
});
exports.insertReferralSchema = (0, drizzle_zod_1.createInsertSchema)(exports.referrals).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
/* ------------------------------------------------------------------ */
exports.referralPayments = (0, pg_core_1.pgTable)('referral_payments', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    affiliateId: (0, pg_core_1.integer)('affiliate_id').notNull().references(() => exports.affiliates.id),
    amount: (0, pg_core_1.decimal)('amount', { precision: 12, scale: 2 }).notNull(),
    currency: (0, pg_core_1.text)('currency').default('NGN'),
    status: (0, pg_core_1.text)('status', { enum: ['pending', 'completed', 'failed'] }).default('pending'),
    paymentMethod: (0, pg_core_1.text)('payment_method', { enum: ['paystack', 'flutterwave', 'manual'] }).default('paystack'),
    transactionReference: (0, pg_core_1.text)('transaction_reference'),
    paymentDate: (0, pg_core_1.timestamp)('payment_date'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
});
exports.insertReferralPaymentSchema = (0, drizzle_zod_1.createInsertSchema)(exports.referralPayments).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
