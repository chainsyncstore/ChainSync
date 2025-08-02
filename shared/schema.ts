import { pgTable, text, integer, timestamp, boolean, json, decimal, uuid, serial } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { customers, customerInsertSchema } from './db/customers.js';
import { z } from 'zod';

// Re-export customers table for compatibility
export { customers };

// Users table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  password: text('password').notNull(),
  role: text('role', { enum: ['admin', 'manager', 'cashier'] }).default('cashier'),
  storeId: integer('store_id'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Stores table
export const stores = pgTable('stores', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  location: text('location').notNull(),
  address: text('address'),
  city: text('city'),
  state: text('state'),
  country: text('country'),
  phone: text('phone'),
  email: text('email'),
  timezone: text('timezone'),
  status: text('status').default('active'),
  managerId: integer('manager_id'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Products table
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  barcode: text('barcode').unique(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  cost: decimal('cost', { precision: 10, scale: 2 }),
  categoryId: integer('category_id'),
  brandId: integer('brand_id'),
  unit: text('unit').default('pcs'),
  isActive: boolean('is_active').default(true),
  isPerishable: boolean('is_perishable').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  storeId: integer('store_id').notNull(),
  imageUrl: text('image_url'),
  attributes: json('attributes'),
  sku: text('sku').notNull(),
});

// Categories table
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Return Reasons table
export const returnReasons = pgTable('return_reasons', {
  id: serial('id').primaryKey(),
  reason: text('reason').notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// Inventory table
export const inventory = pgTable('inventory', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull(),
  storeId: integer('store_id').notNull(),
  quantity: integer('quantity').default(0),
  minStock: integer('min_stock').default(0),
  maxStock: integer('max_stock'),
  lastRestocked: timestamp('last_restocked'),
  updatedAt: timestamp('updated_at').defaultNow(),
  batchTracking: boolean('batch_tracking').default(false),
  currentUtilization: integer('current_utilization').default(0),
  // Aliases expected by legacy services ----------------------------------------------------------
  totalQuantity: integer('total_quantity').default(0),
  availableQuantity: integer('available_quantity').default(0),
  minimumLevel: integer('minimum_level').default(0),
});

// Transactions table
export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  storeId: integer('store_id').notNull(),
  userId: integer('user_id').notNull(),
  customerId: integer('customer_id'),
  total: decimal('total', { precision: 10, scale: 2 }).notNull(),
  subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull(),
  tax: decimal('tax', { precision: 10, scale: 2 }).default('0'),
  discount: decimal('discount', { precision: 10, scale: 2 }).default('0'),
  paymentMethod: text('payment_method', { enum: ['cash', 'card', 'mobile'] }).notNull(),
  status: text('status', { enum: ['pending', 'completed', 'cancelled'] }).default('pending'),
  items: json('items'), // Store transaction items as JSON
  createdAt: timestamp('created_at').defaultNow(),
});

// Returns table
export const returns = pgTable('returns', {
  id: serial('id').primaryKey(),
  refundId: text('refund_id').notNull(),
  total: decimal('total', { precision: 10, scale: 2 }).notNull(),
  refundMethod: text('refund_method', { enum: ['cash', 'credit_card', 'store_credit'] }).default('cash'),
  status: text('status', { enum: ['pending', 'processed'] }).default('pending'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Return Items table
export const returnItems = pgTable('return_items', {
  id: serial('id').primaryKey(),
  returnId: integer('return_id').notNull(),
  productId: integer('product_id').notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
});

// Loyalty Programs table
export const loyaltyPrograms = pgTable('loyalty_programs', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  storeId: integer('store_id').notNull(),
  active: boolean('active').default(true),
});

// Loyalty Members table
export const loyaltyMembers = pgTable('loyalty_members', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  loyaltyId: text('loyalty_id').notNull(),
  currentPoints: decimal('current_points', { precision: 10, scale: 2 }).default('0'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  programId: integer('program_id').notNull(),
  customerId: integer('customer_id').notNull(),
  points: integer('points').default(0),
});

// Loyalty Transactions table
export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id').notNull(),
  programId: integer('program_id').notNull(),
  pointsEarned: integer('points_earned').default(0),
  pointsRedeemed: integer('points_redeemed').default(0),
  pointsBalance: integer('points_balance').notNull(),
  transactionType: text('transaction_type', { enum: ['earn', 'redeem'] }).notNull(),
  source: text('source').notNull(),
  transactionId: integer('transaction_id'),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Loyalty Tiers table
export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: serial('id').primaryKey(),
  programId: integer('program_id').notNull(),
  name: text('name').notNull(),
  requiredPoints: integer('required_points').notNull(),
  multiplier: decimal('multiplier', { precision: 5, scale: 2 }).default('1.00'),
  active: boolean('active').default(true),
});

// Loyalty Rewards table
export const loyaltyRewards = pgTable('loyalty_rewards', {
  id: serial('id').primaryKey(),
  programId: integer('program_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  pointsRequired: integer('points_required').notNull(),
  active: boolean('active').default(true),
});

// Transaction Items table
export const transactionItems = pgTable('transaction_items', {
  id: serial('id').primaryKey(),
  transactionId: integer('transaction_id').notNull(),
  productId: integer('product_id').notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
});

// Transaction Payments table
export const transactionPayments = pgTable('transaction_payments', {
  id: serial('id').primaryKey(),
  transactionId: integer('transaction_id').notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  method: text('method', { enum: ['cash', 'card', 'mobile'] }).notNull(),
});

// Subscriptions table
export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  planId: text('plan_id').notNull(),
  status: text('status', { enum: ['active', 'cancelled', 'expired'] }).default('active'),
  currentPeriodStart: timestamp('current_period_start'),
  currentPeriodEnd: timestamp('current_period_end'),
  endDate: timestamp('end_date'),
  metadata: json('metadata'),
  paymentMethod: text('payment_method'),
  amount: decimal('amount', { precision: 10, scale: 2 }),
  currency: text('currency').default('USD'),
  referralCode: text('referral_code'),
  autoRenew: boolean('auto_renew').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Password Reset Tokens table
export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  token: text('token').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
});

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStoreSchema = createInsertSchema(stores).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInventorySchema = createInsertSchema(inventory).omit({
  id: true,
  updatedAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReturnReasonSchema = createInsertSchema(returnReasons).omit({
  id: true,
  createdAt: true,
});

export const insertLoyaltyTierSchema = createInsertSchema(loyaltyTiers).omit({
  id: true,
});

export const insertLoyaltyRewardSchema = createInsertSchema(loyaltyRewards).omit({
  id: true,
});

export const inventoryBatches = pgTable('inventory_batches', {
  id: serial('id').primaryKey(),
  inventoryId: integer('inventory_id').notNull(),
  batchNumber: text('batch_number'),
  expiryDate: timestamp('expiry_date'),
  quantity: integer('quantity').notNull(),
  receivedDate: timestamp('received_date'),
  manufacturingDate: timestamp('manufacturing_date'),
  costPerUnit: decimal('cost_per_unit', { precision: 10, scale: 2 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const inventoryItems = pgTable('inventory_items', {
  id: serial('id').primaryKey(),
  inventoryId: integer('inventory_id').notNull(),
  productId: integer('product_id').notNull().references(() => products.id),
  quantity: integer('quantity').notNull(),
  sku: text('sku'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  metadata: json('metadata'),
  receivedDate: timestamp('received_date'),
  reorderLevel: integer('reorder_level'),
  reorderQuantity: integer('reorder_quantity'),
});

export const inventoryItemsRelations = relations(inventoryItems, ({ one }) => ({
  product: one(products, {
    fields: [inventoryItems.productId],
    references: [products.id],
  }),
}));

export const inventoryTransactions = pgTable('inventory_transactions', {
  id: serial('id').primaryKey(),
  inventoryId: integer('inventory_id').notNull(),
  itemId: integer('item_id'),
  quantity: integer('quantity').notNull(),
  type: text('type', { enum: ['in', 'out'] }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const webhooks = pgTable('webhooks', {
  id: serial('id').primaryKey(),
  url: text('url').notNull(),
  secret: text('secret'),
  events: json('events'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  storeId: integer('store_id').notNull(),
});

export const webhookEvents = pgTable('webhook_events', {
  id: serial('id').primaryKey(),
  webhookId: integer('webhook_id').notNull(),
  event: text('event').notNull(),
  payload: json('payload'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const webhookDeliveries = pgTable('webhook_deliveries', {
  id: serial('id').primaryKey(),
  webhookId: integer('webhook_id').notNull(),
  eventId: integer('event_id').notNull(),
  status: text('status', { enum: ['pending', 'success', 'failed', 'delivered', 'retrying'] }).default('pending'),
  attempt: integer('attempt').default(1),
  response: text('response'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
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
  id:          serial('id').primaryKey(),
  userId:      integer('user_id').notNull().references(() => users.id),
  code:        text('code').notNull().unique(),
  totalReferrals: integer('total_referrals').default(0),
  totalEarnings:  decimal('total_earnings',  { precision: 12, scale: 2 }).default('0'),
  pendingEarnings:decimal('pending_earnings',{ precision: 12, scale: 2 }).default('0'),

  /* optional payout / bank-detail fields */
  bankName:     text('bank_name'),
  bankCode:     text('bank_code'),
  accountNumber:text('account_number'),
  accountName:  text('account_name'),
  paymentMethod:text('payment_method', { enum: ['paystack', 'flutterwave', 'manual'] }),

  createdAt:    timestamp('created_at').defaultNow(),
  updatedAt:    timestamp('updated_at').defaultNow(),
});

/* Zod insert schema */
export const insertAffiliateSchema = createInsertSchema(affiliates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

/* Type aliases */
export type Affiliate       = typeof affiliates.$inferSelect;
export type AffiliateInsert = z.infer<typeof insertAffiliateSchema>;
/* ------------------------------------------------------------------ */

export const referrals = pgTable('referrals', {
  id:             serial('id').primaryKey(),
  affiliateId:    integer('affiliate_id').notNull().references(() => affiliates.id),
  referredUserId: integer('referred_user_id').notNull().references(() => users.id),
  status:         text('status', { enum: ['pending','active','expired'] }).default('pending'),
  discountApplied:boolean('discount_applied').default(false),
  commissionPaid: boolean('commission_paid').default(false),
  signupDate:     timestamp('signup_date').defaultNow(),
  activationDate: timestamp('activation_date'),
  expiryDate:     timestamp('expiry_date'),
  createdAt:      timestamp('created_at').defaultNow(),
  updatedAt:      timestamp('updated_at').defaultNow(),
});

export const insertReferralSchema = createInsertSchema(referrals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Referral       = typeof referrals.$inferSelect;
export type ReferralInsert = z.infer<typeof insertReferralSchema>;

/* ------------------------------------------------------------------ */

export const referralPayments = pgTable('referral_payments', {
  id:          serial('id').primaryKey(),
  affiliateId: integer('affiliate_id').notNull().references(() => affiliates.id),
  amount:      decimal('amount', { precision: 12, scale: 2 }).notNull(),
  currency:    text('currency').default('NGN'),
  status:      text('status', { enum: ['pending','completed','failed'] }).default('pending'),
  paymentMethod: text('payment_method', { enum: ['paystack','flutterwave','manual'] }).default('paystack'),
  transactionReference: text('transaction_reference'),
  paymentDate: timestamp('payment_date'),
  createdAt:   timestamp('created_at').defaultNow(),
  updatedAt:   timestamp('updated_at').defaultNow(),
});

export const insertReferralPaymentSchema = createInsertSchema(referralPayments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ReferralPayment       = typeof referralPayments.$inferSelect;
export type ReferralPaymentInsert = z.infer<typeof insertReferralPaymentSchema>;
