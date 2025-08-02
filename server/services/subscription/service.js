'use strict';
/**
 * Subscription Service Implementation
 *
 * This file implements a standardized subscription service with proper schema validation
 * and error handling according to our schema style guide.
 */
const __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
  if (k2 === undefined) k2 = k;
  let desc = Object.getOwnPropertyDescriptor(m, k);
  if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
    desc = { enumerable: true, get: function() { return m[k]; } };
  }
  Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
  if (k2 === undefined) k2 = k;
  o[k2] = m[k];
}));
const __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
  Object.defineProperty(o, 'default', { enumerable: true, value: v });
}) : function(o, v) {
  o['default'] = v;
});
const __importStar = (this && this.__importStar) || (function() {
  let ownKeys = function(o) {
    ownKeys = Object.getOwnPropertyNames || function(o) {
      const ar = [];
      for (const k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
      return ar;
    };
    return ownKeys(o);
  };
  return function(mod) {
    if (mod && mod.__esModule) return mod;
    const result = {};
    if (mod != null) for (let k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== 'default') __createBinding(result, mod, k[i]);
    __setModuleDefault(result, mod);
    return result;
  };
})();
Object.defineProperty(exports, '__esModule', { value: true });
exports.SubscriptionService = void 0;
const service_1 = require('../base/service');
const types_1 = require('./types');
const db_1 = require('../../../db');
const schema = __importStar(require('@shared/schema'));
const drizzle_orm_1 = require('drizzle-orm');
class SubscriptionService extends service_1.BaseService {
  /**
     * Create a new subscription with validated data
     */
  async createSubscription(params) {
    try {
      const user = await db_1.db.query.users.findFirst({
        where: (0, drizzle_orm_1.eq)(schema.users.id, params.userId)
      });
      if (!user) {
        throw types_1.SubscriptionServiceErrors.USER_NOT_FOUND;
      }
      const existingSubscription = await this.getActiveSubscription(params.userId);
      if (existingSubscription) {
        throw types_1.SubscriptionServiceErrors.DUPLICATE_SUBSCRIPTION;
      }
      const startDate = params.startDate || new Date();
      const endDate = params.endDate || this.calculateEndDate(startDate, params.plan);
      const [newSubscription] = await db_1.db
        .insert(schema.subscriptions)
        .values({
          userId: params.userId,
          planId: params.plan,
          status: 'active',
          amount: params.amount,
          currency: params.currency || 'NGN',
          currentPeriodStart: startDate,
          currentPeriodEnd: endDate,
          endDate: endDate,
          autoRenew: params.autoRenew ?? true,
          paymentMethod: params.provider || 'manual',
          referralCode: params.providerReference,
          metadata: params.metadata
        })
        .returning();
      if (!newSubscription) {
        throw new Error('Failed to insert subscription');
      }
      return newSubscription;
    }
    catch (error) {
      throw this.handleError(error, 'Creating subscription');
    }
  }
  /**
     * Update a subscription with validated data
     */
  async updateSubscription(subscriptionId, params) {
    try {
      const existingSubscription = await db_1.db.query.subscriptions.findFirst({
        where: (0, drizzle_orm_1.eq)(schema.subscriptions.id, subscriptionId)
      });
      if (!existingSubscription) {
        throw types_1.SubscriptionServiceErrors.SUBSCRIPTION_NOT_FOUND;
      }
      if (params.status && existingSubscription.status && params.status !== params.status) {
        this.validateStatusTransition(existingSubscription.status, params.status);
      }
      const [updatedSubscription] = await db_1.db
        .update(schema.subscriptions)
        .set({ ...params, status: params.status, updatedAt: new Date() })
        .where((0, drizzle_orm_1.eq)(schema.subscriptions.id, subscriptionId))
        .returning();
      if (!updatedSubscription) {
        throw new Error('Operation failed, no subscription updated');
      }
      return updatedSubscription;
    }
    catch (error) {
      throw this.handleError(error, 'Updating subscription');
    }
  }
  /**
     * Get a subscription by ID
     */
  async getSubscriptionById(subscriptionId) {
    try {
      const subscription = await db_1.db.query.subscriptions.findFirst({
        where: (0, drizzle_orm_1.eq)(schema.subscriptions.id, subscriptionId)
      });
      return subscription || null;
    }
    catch (error) {
      throw this.handleError(error, 'Getting subscription by ID');
    }
  }
  /**
     * Get all subscriptions for a user
     */
  async getSubscriptionByUser(userId) {
    try {
      const subscription = await db_1.db.query.subscriptions.findFirst({
        where: (0, drizzle_orm_1.eq)(schema.subscriptions.userId, userId),
        orderBy: [(0, drizzle_orm_1.desc)(schema.subscriptions.createdAt)]
      });
      return subscription || null;
    }
    catch (error) {
      throw this.handleError(error, 'Getting subscription by user');
    }
  }
  /**
     * Search subscriptions with advanced filters
     */
  async searchSubscriptions(params) {
    try {
      const page = params.page || 1;
      const limit = params.limit || 20;
      const offset = (page - 1) * limit;
      const conditions = [];
      if (params.userId)
        conditions.push((0, drizzle_orm_1.eq)(schema.subscriptions.userId, params.userId));
      if (params.plan)
        conditions.push((0, drizzle_orm_1.eq)(schema.subscriptions.planId, params.plan));
      if (params.status)
        conditions.push((0, drizzle_orm_1.eq)(schema.subscriptions.status, params.status));
      if (params.startDate)
        conditions.push((0, drizzle_orm_1.gte)(schema.subscriptions.currentPeriodStart, params.startDate));
      if (params.endDate)
        conditions.push((0, drizzle_orm_1.lte)(schema.subscriptions.currentPeriodEnd, params.endDate));
      if (params.provider)
        conditions.push((0, drizzle_orm_1.eq)(schema.subscriptions.paymentMethod, params.provider));
      const whereClause = (0, drizzle_orm_1.and)(...conditions.filter((c) => !!c));
      const totalResult = await db_1.db.select({ count: (0, drizzle_orm_1.sql) `count(*)` }).from(schema.subscriptions).where(whereClause);
      const total = Number(totalResult[0]?.count || 0);
      const subscriptions = await db_1.db.query.subscriptions.findMany({
        where: whereClause,
        limit,
        offset,
        orderBy: [(0, drizzle_orm_1.desc)(schema.subscriptions.createdAt)],
        with: { user: true }
      });
      return {
        subscriptions: subscriptions,
        total,
        page,
        limit
      };
    }
    catch (error) {
      throw this.handleError(error, 'Searching subscriptions');
    }
  }
  /**
     * Cancel a subscription
     */
  async cancelSubscription(subscriptionId, reason) {
    try {
      const subscription = await this.getSubscriptionById(subscriptionId);
      if (!subscription) {
        throw types_1.SubscriptionServiceErrors.SUBSCRIPTION_NOT_FOUND;
      }
      if (subscription.status !== 'active') {
        throw types_1.SubscriptionServiceErrors.INVALID_CANCELLATION;
      }
      const metadata = subscription.metadata ? subscription.metadata : {};
      const updatedMetadata = {
        ...metadata,
        cancellationReason: reason || 'User cancelled',
        cancelledAt: new Date().toISOString()
      };
      const [updatedSubscription] = await db_1.db
        .update(schema.subscriptions)
        .set({
          status: 'cancelled',
          updatedAt: new Date(),
          metadata: updatedMetadata
        })
        .where((0, drizzle_orm_1.eq)(schema.subscriptions.id, subscriptionId))
        .returning();
      if (!updatedSubscription) {
        throw new Error('Operation failed, no subscription updated');
      }
      return updatedSubscription;
    }
    catch (error) {
      throw this.handleError(error, 'Cancelling subscription');
    }
  }
  /**
     * Renew a subscription
     */
  async renewSubscription(subscriptionId) {
    try {
      const subscription = await this.getSubscriptionById(subscriptionId);
      if (!subscription) {
        throw types_1.SubscriptionServiceErrors.SUBSCRIPTION_NOT_FOUND;
      }
      if (!['active', 'expired', 'past_due'].includes(subscription.status)) {
        throw types_1.SubscriptionServiceErrors.INVALID_RENEWAL;
      }
      const newStartDate = new Date();
      const newEndDate = this.calculateEndDate(newStartDate, subscription.planId);
      const [updatedSubscription] = await db_1.db
        .update(schema.subscriptions)
        .set({
          status: 'active',
          currentPeriodStart: newStartDate,
          currentPeriodEnd: newEndDate,
          endDate: newEndDate,
          updatedAt: new Date()
        })
        .where((0, drizzle_orm_1.eq)(schema.subscriptions.id, subscriptionId))
        .returning();
      if (!updatedSubscription) {
        throw new Error('Operation failed, no subscription updated');
      }
      return updatedSubscription;
    }
    catch (error) {
      throw this.handleError(error, 'Renewing subscription');
    }
  }
  /**
     * Process a webhook event from a payment provider
     */
  async processWebhook(params) {
    try {
      if (!params.provider || !params.event || !params.data) {
        throw new Error('Invalid webhook parameters');
      }
      switch (params.provider) {
        case 'paystack':
          return this.processPaystackWebhook(params.event, params.data);
        case 'flutterwave':
          return this.processFlutterwaveWebhook(params.event, params.data);
        default:
          throw new Error(`Unsupported payment provider: ${params.provider}`);
      }
    }
    catch (error) {
      throw this.handleError(error, 'Processing webhook');
    }
  }
  async processPaystackWebhook(event, data) {
    switch (event) {
      case 'subscription.create':
        return this.handleSubscriptionCreate('paystack', data);
      case 'charge.success':
        return this.handleChargeSuccess('paystack', data);
      case 'subscription.disable':
        return this.handleSubscriptionCancel('paystack', data);
      default:
        console.log(`Unhandled Paystack event: ${event}`);
        return true;
    }
  }
  async processFlutterwaveWebhook(event, data) {
    switch (event) {
      case 'subscription.created':
        return this.handleSubscriptionCreate('flutterwave', data);
      case 'charge.completed':
        return this.handleChargeSuccess('flutterwave', data);
      case 'subscription.cancelled':
        return this.handleSubscriptionCancel('flutterwave', data);
      default:
        console.log(`Unhandled Flutterwave event: ${event}`);
        return true;
    }
  }
  async handleSubscriptionCreate(provider, data) {
    let userId, plan, amount, reference;
    let metadata = {};
    if (provider === 'paystack') {
      userId = parseInt(data.customer.metadata.user_id);
      plan = data.plan.name.toLowerCase();
      amount = (parseFloat(data.amount) / 100).toString();
      reference = data.reference;
      metadata = { paystackCode: data.subscription_code, paystackCustomerCode: data.customer.customer_code };
    }
    else if (provider === 'flutterwave') {
      userId = parseInt(data.customer.meta.user_id);
      plan = data.plan.toLowerCase();
      amount = data.amount.toString();
      reference = data.reference || data.id;
      metadata = { flwReference: data.id, flwCustomerId: data.customer.id };
    }
    else {
      throw new Error(`Unsupported payment provider: ${provider}`);
    }
    const user = await db_1.db.query.users.findFirst({ where: (0, drizzle_orm_1.eq)(schema.users.id, userId) });
    if (!user)
      throw types_1.SubscriptionServiceErrors.USER_NOT_FOUND;
    const existingSubscription = await this.getActiveSubscription(userId);
    if (existingSubscription) {
      return this.updateExistingSubscription(existingSubscription.id, plan, amount, reference);
    }
    await this.createSubscription({ userId, plan, amount, provider: provider, providerReference: reference, metadata });
    return true;
  }
  async handleChargeSuccess(provider, data) {
    let userId;
    if (provider === 'paystack') {
      userId = parseInt(data.customer.metadata.user_id);
    }
    else if (provider === 'flutterwave') {
      userId = parseInt(data.customer.meta.user_id);
    }
    else {
      throw new Error(`Unsupported payment provider: ${provider}`);
    }
    const user = await db_1.db.query.users.findFirst({ where: (0, drizzle_orm_1.eq)(schema.users.id, userId) });
    if (!user)
      throw types_1.SubscriptionServiceErrors.USER_NOT_FOUND;
    const subscription = await this.getSubscriptionByUser(userId);
    if (!subscription)
      return true;
    await this.renewSubscription(subscription.id);
    return true;
  }
  async handleSubscriptionCancel(provider, data) {
    let userId;
    if (provider === 'paystack') {
      userId = parseInt(data.customer.metadata.user_id);
    }
    else if (provider === 'flutterwave') {
      userId = parseInt(data.customer.meta.user_id);
    }
    else {
      throw new Error(`Unsupported payment provider: ${provider}`);
    }
    const subscription = await this.getSubscriptionByUser(userId);
    if (!subscription)
      return true;
    await this.cancelSubscription(subscription.id, 'Cancelled via webhook');
    return true;
  }
  async updateExistingSubscription(subscriptionId, plan, amount, reference) {
    const startDate = new Date();
    const endDate = this.calculateEndDate(startDate, plan);
    await db_1.db.update(schema.subscriptions)
      .set({
        planId: plan,
        amount,
        currentPeriodStart: startDate,
        currentPeriodEnd: endDate,
        endDate,
        status: 'active',
        updatedAt: new Date()
      })
      .where((0, drizzle_orm_1.eq)(schema.subscriptions.id, subscriptionId));
    return true;
  }
  async getActiveSubscription(userId) {
    const now = new Date();
    const result = await db_1.db.query.subscriptions.findFirst({
      where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.subscriptions.userId, userId), (0, drizzle_orm_1.eq)(schema.subscriptions.status, 'active'), (0, drizzle_orm_1.gte)(schema.subscriptions.endDate, now))
    });
    return result || null;
  }
  calculateEndDate(startDate, plan) {
    const endDate = new Date(startDate);
    if (plan.includes('annual') || plan.includes('yearly')) {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }
    else if (plan.includes('quarterly')) {
      endDate.setMonth(endDate.getMonth() + 3);
    }
    else if (plan.includes('biannual')) {
      endDate.setMonth(endDate.getMonth() + 6);
    }
    else {
      endDate.setMonth(endDate.getMonth() + 1);
    }
    return endDate;
  }
  async validateSubscriptionAccess(userId, requiredPlan) {
    const subscription = await this.getActiveSubscription(userId);
    if (!subscription)
      return false;
    if (!requiredPlan)
      return true;
    const planHierarchy = { 'basic': 0, 'premium': 1, 'pro': 2, 'enterprise': 3 };
    const requiredPlanValue = planHierarchy[requiredPlan.toLowerCase()] ?? 0;
    const userPlanValue = planHierarchy[subscription.planId.toLowerCase()] ?? 0;
    return userPlanValue >= requiredPlanValue;
  }
  async getSubscriptionMetrics() {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const totalResult = await db_1.db.select({ count: (0, drizzle_orm_1.sql) `count(*)` }).from(schema.subscriptions);
    const totalSubscriptions = Number(totalResult[0]?.count || 0);
    const activeResult = await db_1.db.select({ count: (0, drizzle_orm_1.sql) `count(*)` }).from(schema.subscriptions).where((0, drizzle_orm_1.eq)(schema.subscriptions.status, 'active'));
    const activeSubscriptions = Number(activeResult[0]?.count || 0);
    const thisMonthRevenueResult = await db_1.db.select({ revenue: (0, drizzle_orm_1.sql) `COALESCE(SUM(${schema.subscriptions.amount}), '0')` }).from(schema.subscriptions).where((0, drizzle_orm_1.gte)(schema.subscriptions.createdAt, thisMonthStart));
    const revenueThisMonth = thisMonthRevenueResult[0].revenue;
    const lastMonthRevenueResult = await db_1.db.select({ revenue: (0, drizzle_orm_1.sql) `COALESCE(SUM(${schema.subscriptions.amount}), '0')` }).from(schema.subscriptions).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.gte)(schema.subscriptions.createdAt, lastMonthStart), (0, drizzle_orm_1.lt)(schema.subscriptions.createdAt, thisMonthStart)));
    const revenueLastMonth = lastMonthRevenueResult[0].revenue;
    const byPlanResult = await db_1.db.select({ plan: schema.subscriptions.planId, count: (0, drizzle_orm_1.sql) `count(*)` }).from(schema.subscriptions).groupBy(schema.subscriptions.planId);
    const subscriptionsByPlan = byPlanResult.reduce((acc, row) => {
      acc[row.plan] = Number(row.count);
      return acc;
    }, {});
    const churnedResult = await db_1.db.select({ count: (0, drizzle_orm_1.sql) `count(*)` }).from(schema.subscriptions).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.subscriptions.status, 'cancelled'), (0, drizzle_orm_1.gte)(schema.subscriptions.updatedAt, lastMonthStart)));
    const churnedCount = Number(churnedResult[0]?.count || 0);
    const churnRate = totalSubscriptions > 0 ? ((churnedCount / totalSubscriptions) * 100).toFixed(2) : '0.00';
    return {
      totalSubscriptions,
      activeSubscriptions,
      revenueThisMonth,
      revenueLastMonth,
      subscriptionsByPlan,
      churnRate: `${churnRate}%`
    };
  }
  validateStatusTransition(currentStatus, newStatus) {
    const allowedTransitions = {
      'active': ['cancelled', 'expired', 'past_due'],
      'pending': ['active', 'cancelled', 'failed'],
      'past_due': ['active', 'cancelled', 'expired'],
      'trial': ['active', 'cancelled', 'expired'],
      'expired': ['active'],
      'cancelled': ['active']
    };
    if (!allowedTransitions[currentStatus]?.includes(newStatus)) {
      throw types_1.SubscriptionServiceErrors.INVALID_STATUS_TRANSITION;
    }
  }
}
exports.SubscriptionService = SubscriptionService;
