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
  async createSubscription(params: CreateSubscriptionParams): Promise<schema.SelectSubscription> {
    try {
      const user = await db.query.users.findFirst({
        where: eq(schema.users.id, params.userId)
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
          userId: params.userId,
          planId: params.plan,
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
  async updateSubscription(subscriptionId: number, params: UpdateSubscriptionParams): Promise<schema.SelectSubscription> {
    try {
      const existingSubscription = await db.query.subscriptions.findFirst({
        where: eq(schema.subscriptions.id, subscriptionId)
      });

      if (!existingSubscription) {
        throw SubscriptionServiceErrors.SUBSCRIPTION_NOT_FOUND;
      }

      if (params.status && existingSubscription.status && params.status !== params.status) {
        this.validateStatusTransition(existingSubscription.status, params.status as string);
      }

      // Build update data that satisfies the schema
      const updateData: Partial<typeof schema.subscriptions.$inferSelect> = {};
      
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
  async getSubscriptionById(subscriptionId: number): Promise<schema.SelectSubscription | null> {
    try {
      const subscription = await db.query.subscriptions.findFirst({
        where: eq(schema.subscriptions.id, subscriptionId)
      });
      return subscription || null;
    } catch (error) {
      throw this.handleError(error as Error, 'Getting subscription by ID');
    }
  }

  /**
   * Get all subscriptions for a user
   */
  async getSubscriptionByUser(userId: number): Promise<schema.SelectSubscription | null> {
    try {
      const subscription = await db.query.subscriptions.findFirst({
        where: eq(schema.subscriptions.userId, userId),
        orderBy: [desc(schema.subscriptions.createdAt)]
      });
      return subscription || null;
    } catch (error) {
      throw this.handleError(error as Error, 'Getting subscription by user');
    }
  }

  /**
   * Search subscriptions with advanced filters
   */
  async searchSubscriptions(params: SubscriptionSearchParams): Promise<{
    subscriptions: schema.SelectSubscription[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const page = params.page || 1;
      const limit = params.limit || 20;
      const offset = (page - 1) * limit;

      const conditions: (SQL | undefined)[] = [];
      if (params.userId) conditions.push(eq(schema.subscriptions.userId, params.userId));
      if (params.plan) conditions.push(eq(schema.subscriptions.planId, params.plan));
      if (params.status) conditions.push(eq(schema.subscriptions.status, params.status as 'active' | 'cancelled' | 'expired'));
      if (params.startDate) conditions.push(gte(schema.subscriptions.currentPeriodStart, params.startDate));
      if (params.endDate) conditions.push(lte(schema.subscriptions.currentPeriodEnd, params.endDate));
      if (params.provider) conditions.push(eq(schema.subscriptions.paymentMethod, params.provider));

      const whereClause = and(...conditions.filter((c): c is SQL => !!c));

      const totalResult = await db.select({ count: sql<number>`count(*)` }).from(schema.subscriptions).where(whereClause);
      const total = Number(totalResult[0]?.count || 0);

      const subscriptions = await db.query.subscriptions.findMany({
        where: whereClause,
        limit,
        offset,
        orderBy: [desc(schema.subscriptions.createdAt)],
        with: { user: true }
      });

      return {
        subscriptions: subscriptions as unknown as schema.SelectSubscription[],
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
  async cancelSubscription(subscriptionId: number, reason?: string): Promise<schema.SelectSubscription> {
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
        cancellationReason: reason || 'User cancelled',
        cancelledAt: new Date().toISOString()
      };

      const [updatedSubscription] = await db
        .update(schema.subscriptions)
        .set({
          userId: subscription.userId,
          planId: subscription.planId
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
  async renewSubscription(subscriptionId: number): Promise<schema.SelectSubscription> {
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
          userId: subscription.userId,
          planId: subscription.planId
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
  async processWebhook(params: ProcessWebhookParams): Promise<boolean> {
    try {
      if (!params.provider || !params.event || !params.data) {
        throw new Error("Invalid webhook parameters");
      }

      switch (params.provider) {
        case 'paystack':
          return this.processPaystackWebhook(params.event, params.data);
        case 'flutterwave':
          return this.processFlutterwaveWebhook(params.event, params.data);
        default:
          throw new Error(`Unsupported payment provider: ${params.provider}`);
      }
    } catch (error) {
      throw this.handleError(error as Error, 'Processing webhook');
    }
  }

  private async processPaystackWebhook(event: string, data: any): Promise<boolean> {
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

  private async processFlutterwaveWebhook(event: string, data: any): Promise<boolean> {
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

  private async handleSubscriptionCreate(provider: string, data: any): Promise<boolean> {
    let userId: number, plan: string, amount: string, reference: string;
    let metadata: Record<string, any> = {};

    if (provider === 'paystack') {
      userId = parseInt(data.customer.metadata.user_id);
      plan = data.plan.name.toLowerCase();
      amount = (parseFloat(data.amount) / 100).toString();
      reference = data.reference;
      metadata = { paystackCode: data.subscription_code, paystackCustomerCode: data.customer.customer_code };
    } else if (provider === 'flutterwave') {
      userId = parseInt(data.customer.meta.user_id);
      plan = data.plan.toLowerCase();
      amount = data.amount.toString();
      reference = data.reference || data.id;
      metadata = { flwReference: data.id, flwCustomerId: data.customer.id };
    } else {
      throw new Error(`Unsupported payment provider: ${provider}`);
    }

    const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
    if (!user) throw SubscriptionServiceErrors.USER_NOT_FOUND;

    const existingSubscription = await this.getActiveSubscription(userId);
    if (existingSubscription) {
      return this.updateExistingSubscription(existingSubscription.id, plan, amount, reference);
    }

    await this.createSubscription({ userId, plan, amount, provider: provider as PaymentProvider, providerReference: reference, metadata });
    return true;
  }

  private async handleChargeSuccess(provider: string, data: any): Promise<boolean> {
    let userId: number;

    if (provider === 'paystack') {
      userId = parseInt(data.customer.metadata.user_id);
    } else if (provider === 'flutterwave') {
      userId = parseInt(data.customer.meta.user_id);
    } else {
      throw new Error(`Unsupported payment provider: ${provider}`);
    }

    const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
    if (!user) throw SubscriptionServiceErrors.USER_NOT_FOUND;

    const subscription = await this.getSubscriptionByUser(userId);
    if (!subscription) return true;

    await this.renewSubscription(subscription.id);
    return true;
  }

  private async handleSubscriptionCancel(provider: string, data: any): Promise<boolean> {
    let userId: number;
    if (provider === 'paystack') {
      userId = parseInt(data.customer.metadata.user_id);
    } else if (provider === 'flutterwave') {
      userId = parseInt(data.customer.meta.user_id);
    } else {
      throw new Error(`Unsupported payment provider: ${provider}`);
    }

    const subscription = await this.getSubscriptionByUser(userId);
    if (!subscription) return true;

    await this.cancelSubscription(subscription.id, 'Cancelled via webhook');
    return true;
  }

  private async updateExistingSubscription(subscriptionId: number, plan: string, amount: string, reference: string): Promise<boolean> {
    const startDate = new Date();
    const endDate = this.calculateEndDate(startDate, plan);

    await db.update(schema.subscriptions)
      .set({
        planId: plan
      })
      .where(eq(schema.subscriptions.id, subscriptionId));

    return true;
  }

  async getActiveSubscription(userId: number): Promise<schema.SelectSubscription | null> {
    const now = new Date();
    const result = await db.query.subscriptions.findFirst({
        where: and(
            eq(schema.subscriptions.userId, userId),
            eq(schema.subscriptions.status, 'active'),
            gte(schema.subscriptions.endDate, now)
        )
    });
    return result || null;
  }

  private calculateEndDate(startDate: Date, plan: string): Date {
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

  async validateSubscriptionAccess(userId: number, requiredPlan?: SubscriptionPlan | string): Promise<boolean> {
    const subscription = await this.getActiveSubscription(userId);
    if (!subscription) return false;
    if (!requiredPlan) return true;

    const planHierarchy: Record<string, number> = { 'basic': 0, 'premium': 1, 'pro': 2, 'enterprise': 3 };
    const requiredPlanValue = planHierarchy[requiredPlan.toLowerCase()] ?? 0;
    const userPlanValue = planHierarchy[subscription.planId.toLowerCase()] ?? 0;

    return userPlanValue >= requiredPlanValue;
  }

  async getSubscriptionMetrics(): Promise<{
    totalSubscriptions: number;
    activeSubscriptions: number;
    revenueThisMonth: string;
    revenueLastMonth: string;
    subscriptionsByPlan: Record<string, number>;
    churnRate: string;
  }> {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const totalResult = await db.select({ count: sql<number>`count(*)` }).from(schema.subscriptions);
    const totalSubscriptions = Number(totalResult[0]?.count || 0);

    const activeResult = await db.select({ count: sql<number>`count(*)` }).from(schema.subscriptions).where(eq(schema.subscriptions.status, 'active'));
    const activeSubscriptions = Number(activeResult[0]?.count || 0);

    const thisMonthRevenueResult = await db.select({ revenue: sql<string>`COALESCE(SUM(${schema.subscriptions.amount}), '0')` }).from(schema.subscriptions).where(gte(schema.subscriptions.createdAt, thisMonthStart));
    const revenueThisMonth = thisMonthRevenueResult[0].revenue;

    const lastMonthRevenueResult = await db.select({ revenue: sql<string>`COALESCE(SUM(${schema.subscriptions.amount}), '0')` }).from(schema.subscriptions).where(and(gte(schema.subscriptions.createdAt, lastMonthStart), lt(schema.subscriptions.createdAt, thisMonthStart)));
    const revenueLastMonth = lastMonthRevenueResult[0].revenue;

    const byPlanResult = await db.select({ plan: schema.subscriptions.planId, count: sql<number>`count(*)` }).from(schema.subscriptions).groupBy(schema.subscriptions.planId);
    const subscriptionsByPlan = byPlanResult.reduce((acc, row) => {
      acc[row.plan] = Number(row.count);
      return acc;
    }, {} as Record<string, number>);

    const churnedResult = await db.select({ count: sql<number>`count(*)` }).from(schema.subscriptions).where(and(eq(schema.subscriptions.status, 'cancelled'), gte(schema.subscriptions.updatedAt, lastMonthStart)));
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

  private validateStatusTransition(currentStatus: string, newStatus: string): void {
    const allowedTransitions: Record<string, string[]> = {
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
