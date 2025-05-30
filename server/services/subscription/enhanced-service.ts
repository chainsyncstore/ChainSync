/**
 * Enhanced Subscription Service
 * 
 * A refactored version of the Subscription service that uses the enhanced base service
 * and utility abstractions to reduce code duplication and improve type safety.
 */
import { EnhancedBaseService } from '@server/services/base/enhanced-service';
import type { ServiceConfig } from '@shared/types/common'; // Correct import for ServiceConfig
import { SubscriptionFormatter } from './formatter';
import { subscriptionValidation, SchemaValidationError } from '@shared/schema-validation';
import { prepareSubscriptionData } from '@shared/schema-helpers';
import { ISubscriptionService, SubscriptionServiceErrors } from './types';
import { 
  CreateSubscriptionParams, 
  UpdateSubscriptionParams,
  SubscriptionSearchParams,
  SubscriptionStatus,
  PaymentProvider,
  ProcessWebhookParams,
  Subscription,
  SubscriptionPlan
} from './types';

import { ErrorCode } from '@shared/types/errors';
import { db } from '../../../db';
import { eq, and, or, like, gte, lte, desc, asc, sql } from 'drizzle-orm';
import * as schema from '@shared/schema';

export class EnhancedSubscriptionService extends EnhancedBaseService implements ISubscriptionService {
  // --- STUBS for missing ISubscriptionService methods ---
  async searchSubscriptions(params: SubscriptionSearchParams): Promise<{ subscriptions: Subscription[]; total: number; page: number; limit: number }> {
    try {
      const { userId, plan, status, startDate, endDate, provider, page = 1, limit = 20 } = params;
      const offset = (page - 1) * limit;
      const filters: string[] = [];
      if (userId) filters.push(`user_id = ${this.safeToString(userId)}`);
      if (plan) filters.push(`plan = '${this.safeToString(plan)}'`);
      if (status) filters.push(`status = '${this.safeToString(status)}'`);
      if (provider) filters.push(`payment_provider = '${this.safeToString(provider)}'`);
      if (startDate) {
        const dateValue = (startDate instanceof Date ? startDate.toISOString() : startDate);
        filters.push(`created_at >= '${typeof dateValue === 'string' ? dateValue : String(dateValue)}'`);
      }
      if (endDate) {
        const dateValue = (endDate instanceof Date ? endDate.toISOString() : endDate);
        filters.push(`created_at <= '${typeof dateValue === 'string' ? dateValue : String(dateValue)}'`);
      }
      const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
      const query = `SELECT * FROM subscriptions ${whereClause} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
      const countQuery = `SELECT COUNT(*) as count FROM subscriptions ${whereClause}`;
      const subscriptions = await this.executeSqlWithMultipleResults(
        query,
        [],
        this.formatter.formatResult.bind(this.formatter)
      );
      const countResult = await db.execute(sql.raw(countQuery));
      const total = Number(countResult.rows?.[0]?.count || 0);
      return { subscriptions, total, page, limit };
    } catch (error: unknown) {
      return this.handleError(error, 'searching subscriptions');
    }
  }

  async cancelSubscription(subscriptionId: number, reason?: string): Promise<Subscription> {
    try {
      const subscription = await this.getSubscriptionById(subscriptionId);
      if (!subscription) throw SubscriptionServiceErrors.SUBSCRIPTION_NOT_FOUND;
      if (subscription.status === SubscriptionStatus.CANCELLED) {
        throw SubscriptionServiceErrors.INVALID_CANCELLATION;
      }
      const metadata = {
        ...(subscription.metadata || {}),
        cancellationReason: reason || '',
        cancelledAt: new Date().toISOString(),
      };
      const updated = await this.updateSubscription(subscriptionId, {
        status: SubscriptionStatus.CANCELLED,
        metadata
      });
      return updated;
    } catch (error: unknown) {
      return this.handleError(error, 'cancelling subscription');
    }
  }

  async renewSubscription(subscriptionId: number): Promise<Subscription> {
    try {
      const subscription = await this.getSubscriptionById(subscriptionId);
      if (!subscription) throw SubscriptionServiceErrors.SUBSCRIPTION_NOT_FOUND;
      if (subscription.status !== SubscriptionStatus.EXPIRED && subscription.status !== SubscriptionStatus.PAST_DUE) {
        throw SubscriptionServiceErrors.INVALID_RENEWAL;
      }
      // Calculate new start and end dates
      const now = new Date();
      const startDate = now;
      // Support recurring monthly or yearly renewal based on 'renewalPeriod' in metadata or params
      let renewalPeriod = 'monthly';
      let metadataObj: unknown = {};
      if (subscription.metadata) {
        if (typeof subscription.metadata === 'string') {
          try {
            metadataObj = JSON.parse(subscription.metadata);
          } catch (e: unknown) {
            metadataObj = {};
          }
        } else if (typeof subscription.metadata === 'object') {
          metadataObj = subscription.metadata;
        }
      }
      if (
        typeof metadataObj === 'object' &&
        metadataObj !== null &&
        'renewalPeriod' in metadataObj &&
        typeof (metadataObj as { renewalPeriod?: unknown }).renewalPeriod === 'string'
      ) {
        renewalPeriod = (metadataObj as { renewalPeriod: string }).renewalPeriod;
      }
      // Allow override from params in future if needed
      const endDate = new Date(now);
      if (renewalPeriod === 'yearly') {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else {
        endDate.setMonth(endDate.getMonth() + 1);
      }
      // Only allowed fields in UpdateSubscriptionParams: status, endDate, etc.
      const updated = await this.updateSubscription(subscriptionId, {
        status: SubscriptionStatus.ACTIVE,
        endDate
        // If you want to support startDate, add it to UpdateSubscriptionParams and schema
      });
      return updated;
    } catch (error: unknown) {
      return this.handleError(error, 'renewing subscription');
    }
  }

  async processWebhook(params: ProcessWebhookParams): Promise<boolean> {
    // Placeholder: In production, validate and process webhook payload
    console.log('Received webhook:', params);
    return false;
  }

  async validateSubscriptionAccess(userId: number, requiredPlan?: SubscriptionPlan | string): Promise<boolean> {
    try {
      const subscription = await this.getActiveSubscription(userId);
      if (!subscription) return false;
      if (requiredPlan && subscription.plan !== requiredPlan) return false;
      return true;
    } catch (error: unknown) {
      return false;
    }
  }

  async getSubscriptionMetrics(): Promise<{ totalSubscriptions: number; activeSubscriptions: number; revenueThisMonth: string; revenueLastMonth: string; subscriptionsByPlan: Record<string, number>; churnRate: string }> {
    try {
      // Total subscriptions
      const totalResult = await db.execute(sql.raw('SELECT COUNT(*) as count FROM subscriptions'));
      const totalSubscriptions = Number(totalResult.rows?.[0]?.count || 0);
      // Active subscriptions
      const activeResult = await db.execute(sql.raw("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'active'"));
      const activeSubscriptions = Number(activeResult.rows?.[0]?.count || 0);
      // Revenue this month
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastOfPrevMonth = new Date(firstOfMonth);
      lastOfPrevMonth.setDate(0);
      const firstOfPrevMonth = new Date(lastOfPrevMonth.getFullYear(), lastOfPrevMonth.getMonth(), 1);
      const revenueThisMonthResult = await db.execute(sql.raw(`SELECT SUM(amount) as sum FROM subscriptions WHERE status = 'active' AND created_at >= '${firstOfMonth.toISOString()}'`));
      const revenueLastMonthResult = await db.execute(sql.raw(`SELECT SUM(amount) as sum FROM subscriptions WHERE status = 'active' AND created_at >= '${firstOfPrevMonth.toISOString()}' AND created_at < '${firstOfMonth.toISOString()}'`));
      const revenueThisMonth = String(revenueThisMonthResult.rows?.[0]?.sum || '0.00');
      const revenueLastMonth = String(revenueLastMonthResult.rows?.[0]?.sum || '0.00');
      // Subscriptions by plan
      const plansResult = await db.execute(sql.raw('SELECT plan, COUNT(*) as count FROM subscriptions GROUP BY plan'));
      const subscriptionsByPlan: Record<string, number> = {};
      (plansResult.rows || []).forEach((row: unknown) => {
        if (
          typeof row === 'object' &&
          row !== null &&
          'plan' in row &&
          'count' in row &&
          typeof (row as { plan?: unknown }).plan === 'string'
        ) {
          subscriptionsByPlan[(row as { plan: string }).plan] = Number((row as { count: unknown }).count);
        } else {
          console.warn('Unexpected row structure in getSubscriptionMetrics:', row);
        }
      });
      // Churn rate: (cancelled in last 30d) / active
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(now.getDate() - 30);
      const churnResult = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM subscriptions WHERE status = 'cancelled' AND updated_at >= '${thirtyDaysAgo.toISOString()}'`));
      const churnCount = Number(churnResult.rows?.[0]?.count || 0);
      const churnRate = activeSubscriptions > 0 ? ((churnCount / activeSubscriptions) * 100).toFixed(2) + '%' : '0.00%';
      return { totalSubscriptions, activeSubscriptions, revenueThisMonth, revenueLastMonth, subscriptionsByPlan, churnRate };
    } catch (error: unknown) {
      return this.handleError(error, 'getting subscription metrics');
    }
  }
  // --- END STUBS ---
  private formatter: SubscriptionFormatter;
  
  constructor(config: ServiceConfig) { // Changed unknown to ServiceConfig
    super(config);
    this.formatter = new SubscriptionFormatter();
  }

  // Local safeToString helper for SQL queries
  private safeToString(value: unknown): string {
    if (typeof value === 'string' || typeof value === 'number') {
      return value.toString();
    }
    throw new Error('Invalid value for SQL interpolation');
  }
  
  /**
   * Create a new subscription with validated data
   * 
   * @param params Subscription creation parameters
   * @returns The created subscription
   */
  async createSubscription(params: CreateSubscriptionParams): Promise<Subscription> {
    try {
      // Validate and prepare the data
      const validatedData = subscriptionValidation.insert(params);
      const preparedData = prepareSubscriptionData(validatedData);
      
      // Use the raw insert method to avoid TypeScript field mapping errors
      const subscription = await this.rawInsertWithFormatting(
        'subscriptions',
        preparedData,
        this.formatter.formatResult.bind(this.formatter)
      );
      
      // Ensure the subscription was created
      return this.ensureExists(subscription, 'Subscription');
    } catch (error: unknown) {
      if (error instanceof SchemaValidationError) {
        console.error(`Validation error: ${error.message}`, error.toJSON());
      }
      return this.handleError(error, 'creating subscription');
    }
  }
  
  /**
   * Update a subscription with validated data
   * 
   * @param subscriptionId ID of the subscription to update
   * @param params Subscription update parameters
   * @returns The updated subscription
   */
  async updateSubscription(subscriptionId: number, params: UpdateSubscriptionParams): Promise<Subscription> {
    try {
      // Get existing subscription
      const existingSubscription = await this.getSubscriptionById(subscriptionId);
      if (!existingSubscription) {
        throw SubscriptionServiceErrors.SUBSCRIPTION_NOT_FOUND;
      }
      
      // Validate status transition if being updated
      if (params.status && params.status !== existingSubscription.status) {
        this.validateStatusTransition(existingSubscription.status, params.status);
      }
      
      // Prepare update data with proper field names
      const updateData = {
        ...params,
        metadata: params.metadata ? JSON.stringify(params.metadata) : existingSubscription.metadata,
        updatedAt: new Date()
      };
      
      // Validate and prepare the data
      const validatedData = subscriptionValidation.update(updateData);
      const preparedData = prepareSubscriptionData(validatedData);
      
      // Use the raw update method to avoid TypeScript field mapping errors
      const updatedSubscription = await this.rawUpdateWithFormatting(
        'subscriptions',
        preparedData,
        `id = ${subscriptionId}`,
        this.formatter.formatResult.bind(this.formatter)
      );
      
      // Ensure the subscription was updated
      return this.ensureExists(updatedSubscription, 'Subscription');
    } catch (error: unknown) {
      return this.handleError(error, 'updating subscription');
    }
  }
  
  /**
   * Get a subscription by ID
   * 
   * @param subscriptionId ID of the subscription to retrieve
   * @returns The subscription or null if not found
   */
  async getSubscriptionById(subscriptionId: number): Promise<Subscription | null> {
    try {
      // Create a simple query to fetch the subscription
      const query = `
        SELECT * FROM subscriptions WHERE id = ${this.safeToString(subscriptionId)}
      `;
      
      // Execute the query and format the result
      return await this.executeSqlWithFormatting(
        query,
        [],
        this.formatter.formatResult.bind(this.formatter)
      );
    } catch (error: unknown) {
      return this.handleError(error, 'getting subscription by ID');
    }
  }
  
  /**
   * Get all subscriptions for a user
   * 
   * @param userId ID of the user
   * @returns The subscription or null if not found
   */
  async getSubscriptionByUser(userId: number): Promise<Subscription | null> {
    try {
      // Create a simple query to fetch the subscription
      const query = `
        SELECT * FROM subscriptions 
        WHERE user_id = ${this.safeToString(userId)}
        ORDER BY created_at DESC
        LIMIT 1
      `;
      
      // Execute the query and format the result
      return await this.executeSqlWithFormatting(
        query,
        [],
        this.formatter.formatResult.bind(this.formatter)
      );
    } catch (error: unknown) {
      return this.handleError(error, 'getting subscription by user');
    }
  }
  
  /**
   * Get the active subscription for a user
   * 
   * @param userId ID of the user
   * @returns The active subscription or null if not found
   */
  async getActiveSubscription(userId: number): Promise<Subscription | null> {
    try {
      // Create a query to fetch the active subscription
      const query = `
        SELECT * FROM subscriptions 
        WHERE user_id = ${this.safeToString(userId)} 
        AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1
      `;
      
      // Execute the query and format the result
      return await this.executeSqlWithFormatting(
        query,
        [],
        this.formatter.formatResult.bind(this.formatter)
      );
    } catch (error: unknown) {
      return this.handleError(error, 'getting active subscription');
    }
  }
  
  /**
   * Validate that a subscription status transition is allowed
   * 
   * @param currentStatus Current status of the subscription
   * @param newStatus New status to transition to
   * @throws If the transition is not allowed
   */
  validateStatusTransition(currentStatus: string, newStatus: string): void {
    // Define allowed transitions
    const allowedTransitions: Record<string, string[]> = {
      [SubscriptionStatus.ACTIVE]: [
        SubscriptionStatus.CANCELLED,
        SubscriptionStatus.EXPIRED,
        SubscriptionStatus.FAILED
      ],
      [SubscriptionStatus.PENDING]: [
        SubscriptionStatus.ACTIVE,
        SubscriptionStatus.FAILED,
        SubscriptionStatus.CANCELLED
      ],
      [SubscriptionStatus.EXPIRED]: [
        SubscriptionStatus.ACTIVE
      ],
      [SubscriptionStatus.CANCELLED]: [
        SubscriptionStatus.ACTIVE
      ],
      [SubscriptionStatus.FAILED]: [
        SubscriptionStatus.ACTIVE
      ]
    };
    
    // Check if transition is allowed
    if (
      currentStatus === newStatus ||
      !allowedTransitions[currentStatus] ||
      !allowedTransitions[currentStatus].includes(newStatus)
    ) {
      throw SubscriptionServiceErrors.INVALID_STATUS_TRANSITION;
    }
  }
}
