/**
 * Subscription Service Implementation
 *
 * This file implements a standardized subscription service with proper schema validation
 * and error handling according to our schema style guide.
 */

import { z } from 'zod';
import { BaseService } from '../base/service';
import {
  ISubscriptionService,
  SubscriptionServiceErrors,
  CreateSubscriptionParams,
  UpdateSubscriptionParams,
  SubscriptionSearchParams,
  ProcessWebhookParams,
  SubscriptionPlan,
  PaymentProvider
} from './types';
import { db } from '../../../db/index.js';
import * as schema from '../../../shared/schema.js';
import { eq, and, or, like, gte, lte, lt, desc, asc, sql, SQL } from 'drizzle-orm';

export class SubscriptionService extends BaseService implements ISubscriptionService {
  /**
   * Create a new subscription with validated data
   */
  async createSubscription(_params: CreateSubscriptionParams): Promise<schema.SelectSubscription> {
    try {
      const user = await db.query.users.findFirst({
        _where: eq(schema.users.id, params.userId)
      });

      if (!user) {
        throw SubscriptionServiceErrors.USER_NOT_FOUND;
      }

      const existingSubscription = await this.getActiveSubscription(params.userId);

      if (existingSubscription) {
        throw SubscriptionServiceErrors.DUPLICATE_SUBSCRIPTION;
      }

      const startDate = params.startDate || new Date();
      const endDate = params.endDate || this.calculateEndDate(startDate, params.plan);

      const [newSubscription] = await db
        .insert(schema.subscriptions)
        .values({
          _userId: params.userId,
          _planId: params.plan
        })
        .returning();

      if (!newSubscription) {
        throw new Error('Failed to insert subscription');
      }

      return newSubscription;
    } catch (error) {
      throw this.handleError(error as Error, 'Creating subscription');
    }
  }

  /**
   * Update a subscription with validated data
   */
  async updateSubscription(_subscriptionId: number, _params: UpdateSubscriptionParams): Promise<schema.SelectSubscription> {
    try {
      const existingSubscription = await db.query.subscriptions.findFirst({
        _where: eq(schema.subscriptions.id, subscriptionId)
      });

      if (!existingSubscription) {
        throw SubscriptionServiceErrors.SUBSCRIPTION_NOT_FOUND;
      }

      if (params.status && existingSubscription.status && params.status !== params.status) {
        this.validateStatusTransition(existingSubscription.status, params.status as string);
      }

      // Build update data that satisfies the schema
      const _updateData: Partial<typeof schema.subscriptions.$inferSelect> = {};

      // Map valid subscription fields from params
      if (params.plan !== undefined) updateData.planId = params.plan;
      if (params.status !== undefined) updateData.status = params.status as 'active' | 'cancelled' | 'expired' | null;
      if (params.amount !== undefined) updateData.amount = params.amount;
      if (params.currency !== undefined) updateData.currency = params.currency;
      if (params.endDate !== undefined) updateData.endDate = params.endDate;

      const [updatedSubscription] = await db
        .update(schema.subscriptions)
        .set(updateData)
        .where(eq(schema.subscriptions.id, subscriptionId))
        .returning();

      if (!updatedSubscription) {
        throw new Error('Operation failed, no subscription updated');
      }

      return updatedSubscription;
    } catch (error) {
      throw this.handleError(error as Error, 'Updating subscription');
    }
  }

  /**
   * Get a subscription by ID
   */
  async getSubscriptionById(_subscriptionId: number): Promise<schema.SelectSubscription | null> {
    try {
      const subscription = await db.query.subscriptions.findFirst({
        _where: eq(schema.subscriptions.id, subscriptionId)
      });
      return subscription || null;
    } catch (error) {
      throw this.handleError(error as Error, 'Getting subscription by ID');
    }
  }

  /**
   * Get all subscriptions for a user
   */
  async getSubscriptionByUser(_userId: number): Promise<schema.SelectSubscription | null> {
    try {
      const subscription = await db.query.subscriptions.findFirst({
        _where: eq(schema.subscriptions.userId, userId),
        _orderBy: [desc(schema.subscriptions.createdAt)]
      });
      return subscription || null;
    } catch (error) {
      throw this.handleError(error as Error, 'Getting subscription by user');
    }
  }

  /**
   * Search subscriptions with advanced filters
   */
  async searchSubscriptions(_params: SubscriptionSearchParams): Promise<{
    _subscriptions: schema.SelectSubscription[];
    _total: number;
    _page: number;
    _limit: number;
  }> {
    try {
      const page = params.page || 1;
      const limit = params.limit || 20;
      const offset = (page - 1) * limit;

      const _conditions: (SQL | undefined)[] = [];
      if (params.userId) conditions.push(eq(schema.subscriptions.userId, params.userId));
      if (params.plan) conditions.push(eq(schema.subscriptions.planId, params.plan));
      if (params.status) conditions.push(eq(schema.subscriptions.status, params.status as 'active' | 'cancelled' | 'expired'));
      if (params.startDate) conditions.push(gte(schema.subscriptions.currentPeriodStart, params.startDate));
      if (params.endDate) conditions.push(lte(schema.subscriptions.currentPeriodEnd, params.endDate));
      if (params.provider) conditions.push(eq(schema.subscriptions.paymentMethod, params.provider));

      const whereClause = and(...conditions.filter((c): c is SQL => !!c));

      const totalResult = await db.select({ _count: sql<number>`count(*)` }).from(schema.subscriptions).where(whereClause);
      const total = Number(totalResult[0]?.count || 0);

      const subscriptions = await db.query.subscriptions.findMany({
        _where: whereClause,
        limit,
        offset,
        _orderBy: [desc(schema.subscriptions.createdAt)],
        _with: { _user: true }
      });

      return {
        _subscriptions: subscriptions as unknown as schema.SelectSubscription[],
        total,
        page,
        limit
      };
    } catch (error) {
      throw this.handleError(error as Error, 'Searching subscriptions');
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(_subscriptionId: number, reason?: string): Promise<schema.SelectSubscription> {
    try {
      const subscription = await this.getSubscriptionById(subscriptionId);

      if (!subscription) {
        throw SubscriptionServiceErrors.SUBSCRIPTION_NOT_FOUND;
      }

      if (subscription.status !== 'active') {
        throw SubscriptionServiceErrors.INVALID_CANCELLATION;
      }

      const metadata = subscription.metadata ? (subscription.metadata as Record<string, any>) : {};
      const updatedMetadata = {
        ...metadata,
        _cancellationReason: reason || 'User cancelled',
        _cancelledAt: new Date().toISOString()
      };

      const [updatedSubscription] = await db
        .update(schema.subscriptions)
        .set({
          _userId: subscription.userId,
          _planId: subscription.planId
        })
        .where(eq(schema.subscriptions.id, subscriptionId))
        .returning();

      if (!updatedSubscription) {
        throw new Error('Operation failed, no subscription updated');
      }

      return updatedSubscription;
    } catch (error) {
      throw this.handleError(error as Error, 'Cancelling subscription');
    }
  }

  /**
   * Renew a subscription
   */
  async renewSubscription(_subscriptionId: number): Promise<schema.SelectSubscription> {
    try {
      const subscription = await this.getSubscriptionById(subscriptionId);

      if (!subscription) {
        throw SubscriptionServiceErrors.SUBSCRIPTION_NOT_FOUND;
      }

      if (!['active', 'expired', 'past_due'].includes(subscription.status as string)) {
        throw SubscriptionServiceErrors.INVALID_RENEWAL;
      }

      const newStartDate = new Date();
      const newEndDate = this.calculateEndDate(newStartDate, subscription.planId);

      const [updatedSubscription] = await db
        .update(schema.subscriptions)
        .set({
          _userId: subscription.userId,
          _planId: subscription.planId
        })
        .where(eq(schema.subscriptions.id, subscriptionId))
        .returning();

      if (!updatedSubscription) {
        throw new Error('Operation failed, no subscription updated');
      }

      return updatedSubscription;
    } catch (error) {
      throw this.handleError(error as Error, 'Renewing subscription');
    }
  }

  /**
   * Process a webhook event from a payment provider
   */
  async processWebhook(_params: ProcessWebhookParams): Promise<boolean> {
    try {
      if (!params.provider || !params.event || !params.data) {
        throw new Error('Invalid webhook parameters');
      }

      switch (params.provider) {
        case 'paystack':
          return this.processPaystackWebhook(params.event, params.data);
        case 'flutterwave':
          return this.processFlutterwaveWebhook(params.event, params.data);
        throw new Error(`Unsupported payment provider: ${params.provider}`);
      }
    } catch (error) {
      throw this.handleError(error as Error, 'Processing webhook');
    }
  }

  private async processPaystackWebhook(_event: string, _data: any): Promise<boolean> {
    switch (event) {
      case 'subscription.create':
        return this.handleSubscriptionCreate('paystack', data);
      case 'charge.success':
        return this.handleChargeSuccess('paystack', data);
      case 'subscription.disable':
        return this.handleSubscriptionCancel('paystack', data);
      console.log(`Unhandled Paystack event: ${event}`);
        return true;
    }
  }

  private async processFlutterwaveWebhook(_event: string, _data: any): Promise<boolean> {
    switch (event) {
      case 'subscription.created':
        return this.handleSubscriptionCreate('flutterwave', data);
      case 'charge.completed':
        return this.handleChargeSuccess('flutterwave', data);
      case 'subscription.cancelled':
        return this.handleSubscriptionCancel('flutterwave', data);
      console.log(`Unhandled Flutterwave event: ${event}`);
        return true;
    }
  }

  private async handleSubscriptionCreate(_provider: string, _data: any): Promise<boolean> {
    let _userId: number, _plan: string, _amount: string, _reference: string;
    const _metadata: Record<string, any> = {};

    if (provider === 'paystack') {
      userId = parseInt(data.customer.metadata.user_id);
      plan = data.plan.name.toLowerCase();
      amount = (parseFloat(data.amount) / 100).toString();
      reference = data.reference;
      metadata = { _paystackCode: data.subscription_code, _paystackCustomerCode: data.customer.customer_code };
    } else if (provider === 'flutterwave') {
      userId = parseInt(data.customer.meta.user_id);
      plan = data.plan.toLowerCase();
      amount = data.amount.toString();
      reference = data.reference || data.id;
      metadata = { _flwReference: data.id, _flwCustomerId: data.customer.id };
    } else {
      throw new Error(`Unsupported payment provider: ${provider}`);
    }

    const user = await db.query.users.findFirst({ _where: eq(schema.users.id, userId) });
    if (!user) throw SubscriptionServiceErrors.USER_NOT_FOUND;

    const existingSubscription = await this.getActiveSubscription(userId);
    if (existingSubscription) {
      return this.updateExistingSubscription(existingSubscription.id, plan, amount, reference);
    }

    await this.createSubscription({ userId, plan, amount, _provider: provider as PaymentProvider, _providerReference: reference, metadata });
    return true;
  }

  private async handleChargeSuccess(_provider: string, _data: any): Promise<boolean> {
    let _userId: number;

    if (provider === 'paystack') {
      userId = parseInt(data.customer.metadata.user_id);
    } else if (provider === 'flutterwave') {
      userId = parseInt(data.customer.meta.user_id);
    } else {
      throw new Error(`Unsupported payment _provider: ${provider}`);
    }

    const user = await db.query.users.findFirst({ _where: eq(schema.users.id, userId) });
    if (!user) throw SubscriptionServiceErrors.USER_NOT_FOUND;

    const subscription = await this.getSubscriptionByUser(userId);
    if (!subscription) return true;

    await this.renewSubscription(subscription.id);
    return true;
  }

  private async handleSubscriptionCancel(_provider: string, _data: any): Promise<boolean> {
    let _userId: number;
    if (provider === 'paystack') {
      userId = parseInt(data.customer.metadata.user_id);
    } else if (provider === 'flutterwave') {
      userId = parseInt(data.customer.meta.user_id);
    } else {
      throw new Error(`Unsupported payment _provider: ${provider}`);
    }

    const subscription = await this.getSubscriptionByUser(userId);
    if (!subscription) return true;

    await this.cancelSubscription(subscription.id, 'Cancelled via webhook');
    return true;
  }

  private async updateExistingSubscription(_subscriptionId: number, _plan: string, _amount: string, _reference: string): Promise<boolean> {
    const startDate = new Date();
    const endDate = this.calculateEndDate(startDate, plan);

    await db.update(schema.subscriptions)
      .set({
        _planId: plan
      })
      .where(eq(schema.subscriptions.id, subscriptionId));

    return true;
  }

  async getActiveSubscription(_userId: number): Promise<schema.SelectSubscription | null> {
    const now = new Date();
    const result = await db.query.subscriptions.findFirst({
        _where: and(
            eq(schema.subscriptions.userId, userId),
            eq(schema.subscriptions.status, 'active'),
            gte(schema.subscriptions.endDate, now)
        )
    });
    return result || null;
  }

  private calculateEndDate(_startDate: Date, _plan: string): Date {
    const endDate = new Date(startDate);
    if (plan.includes('annual') || plan.includes('yearly')) {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else if (plan.includes('quarterly')) {
      endDate.setMonth(endDate.getMonth() + 3);
    } else if (plan.includes('biannual')) {
      endDate.setMonth(endDate.getMonth() + 6);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }
    return endDate;
  }

  async validateSubscriptionAccess(_userId: number, requiredPlan?: SubscriptionPlan | string): Promise<boolean> {
    const subscription = await this.getActiveSubscription(userId);
    if (!subscription) return false;
    if (!requiredPlan) return true;

    const _planHierarchy: Record<string, number> = { 'basic': 0, 'premium': 1, 'pro': 2, 'enterprise': 3 };
    const requiredPlanValue = planHierarchy[requiredPlan.toLowerCase()] ?? 0;
    const userPlanValue = planHierarchy[subscription.planId.toLowerCase()] ?? 0;

    return userPlanValue >= requiredPlanValue;
  }

  async getSubscriptionMetrics(): Promise<{
    _totalSubscriptions: number;
    _activeSubscriptions: number;
    _revenueThisMonth: string;
    _revenueLastMonth: string;
    _subscriptionsByPlan: Record<string, number>;
    _churnRate: string;
  }> {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const totalResult = await db.select({ _count: sql<number>`count(*)` }).from(schema.subscriptions);
    const totalSubscriptions = Number(totalResult[0]?.count || 0);

    const activeResult = await db.select({ _count: sql<number>`count(*)` }).from(schema.subscriptions).where(eq(schema.subscriptions.status, 'active'));
    const activeSubscriptions = Number(activeResult[0]?.count || 0);

    const thisMonthRevenueResult = await db.select({ _revenue: sql<string>`COALESCE(SUM(${schema.subscriptions.amount}), '0')` }).from(schema.subscriptions).where(gte(schema.subscriptions.createdAt, thisMonthStart));
    const revenueThisMonth = thisMonthRevenueResult[0]?.revenue || '0';

    const lastMonthRevenueResult = await db.select({ _revenue: sql<string>`COALESCE(SUM(${schema.subscriptions.amount}), '0')` }).from(schema.subscriptions).where(and(gte(schema.subscriptions.createdAt, lastMonthStart), lt(schema.subscriptions.createdAt, thisMonthStart)));
    const revenueLastMonth = lastMonthRevenueResult[0]?.revenue || '0';

    const byPlanResult = await db.select({ _plan: schema.subscriptions.planId, _count: sql<number>`count(*)` }).from(schema.subscriptions).groupBy(schema.subscriptions.planId);
    const subscriptionsByPlan = byPlanResult.reduce((acc, row) => {
      acc[row.plan] = Number(row.count);
      return acc;
    }, {} as Record<string, number>);

    const churnedResult = await db.select({ _count: sql<number>`count(*)` }).from(schema.subscriptions).where(and(eq(schema.subscriptions.status, 'cancelled'), gte(schema.subscriptions.updatedAt, lastMonthStart)));
    const churnedCount = Number(churnedResult[0]?.count || 0);
    const churnRate = totalSubscriptions > 0 ? ((churnedCount / totalSubscriptions) * 100).toFixed(2) : '0.00';

    return {
      totalSubscriptions,
      activeSubscriptions,
      revenueThisMonth,
      revenueLastMonth,
      subscriptionsByPlan,
      _churnRate: `${churnRate}%`
    };
  }

  private validateStatusTransition(_currentStatus: string, _newStatus: string): void {
    const _allowedTransitions: Record<string, string[]> = {
      'active': ['cancelled', 'expired', 'past_due'],
      'pending': ['active', 'cancelled', 'failed'],
      'past_due': ['active', 'cancelled', 'expired'],
      'trial': ['active', 'cancelled', 'expired'],
      'expired': ['active'],
      'cancelled': ['active']
    };

    if (!allowedTransitions[currentStatus]?.includes(newStatus)) {
      throw SubscriptionServiceErrors.INVALID_STATUS_TRANSITION;
    }
  }
}
