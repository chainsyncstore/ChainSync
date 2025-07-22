/**
 * Enhanced Subscription Service
 *
 * A refactored implementation that extends the common EnhancedBaseService
 * and satisfies the entire ISubscriptionService contract.
 */

import { EnhancedBaseService } from '../base/enhanced-service';
import { SubscriptionFormatter } from './formatter';
import {
  subscriptionValidation,
  SchemaValidationError,
} from '@shared/schema-validation';
import { prepareSubscriptionData } from '@shared/schema-helpers';

import {
  CreateSubscriptionParams,
  UpdateSubscriptionParams,
  SubscriptionSearchParams,
  SubscriptionStatus,
  SubscriptionPlan,
  PaymentProvider,
  ProcessWebhookParams,
  Subscription,
  ISubscriptionService,
  SubscriptionServiceErrors,
} from './types';

import { db } from '@server/db';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import * as schema from '@shared/schema';

export class EnhancedSubscriptionService
  extends EnhancedBaseService
  implements ISubscriptionService
{
  private readonly formatter = new SubscriptionFormatter();

  /* -------------------------------------------------------------------------- */
  /*                               CRUD METHODS                                 */
  /* -------------------------------------------------------------------------- */

  async createSubscription(
    params: CreateSubscriptionParams,
  ): Promise<Subscription> {
    try {
      // Validate & transform
      const validated = subscriptionValidation.insert(params);
      const data = prepareSubscriptionData(validated);

      const subscription = await this.rawInsertWithFormatting(
        'subscriptions',
        data,
        this.formatter.formatResult.bind(this.formatter),
      );

      return this.ensureExists(subscription, 'Subscription');
    } catch (err) {
      if (err instanceof SchemaValidationError) {
        console.error(`Validation error: ${err.message}`, err.toJSON());
      }
      return this.handleError(err, 'creating subscription');
    }
  }

  async updateSubscription(
    subscriptionId: number,
    params: UpdateSubscriptionParams,
  ): Promise<Subscription> {
    try {
      const existing = await this.getSubscriptionById(subscriptionId);
      if (!existing) throw SubscriptionServiceErrors.SUBSCRIPTION_NOT_FOUND;

      if (params.status && params.status !== existing.status) {
        this.validateStatusTransition(existing.status, params.status);
      }

      const updateData = {
        ...params,
        metadata: params.metadata
          ? JSON.stringify(params.metadata)
          : existing.metadata,
        updatedAt: new Date(),
      };

      const validated = subscriptionValidation.update(updateData);
      const prepared = prepareSubscriptionData(validated);

      const updated = await this.rawUpdateWithFormatting(
        'subscriptions',
        prepared,
        `id = ${subscriptionId}`,
        this.formatter.formatResult.bind(this.formatter),
      );

      return this.ensureExists(updated, 'Subscription');
    } catch (err) {
      return this.handleError(err, 'updating subscription');
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                               READ METHODS                                 */
  /* -------------------------------------------------------------------------- */

  async getSubscriptionById(id: number): Promise<Subscription | null> {
    try {
      return await this.executeSqlWithFormatting(
        `SELECT * FROM subscriptions WHERE id = ${id}`,
        [],
        this.formatter.formatResult.bind(this.formatter),
      );
    } catch (err) {
      return this.handleError(err, 'getting subscription by ID');
    }
  }

  async getSubscriptionByUser(userId: number): Promise<Subscription | null> {
    try {
      return await this.executeSqlWithFormatting(
        `
        SELECT * FROM subscriptions
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT 1
      `,
        [],
        this.formatter.formatResult.bind(this.formatter),
      );
    } catch (err) {
      return this.handleError(err, 'getting subscription by user');
    }
  }

  async getActiveSubscription(userId: number): Promise<Subscription | null> {
    try {
      return await this.executeSqlWithFormatting(
        `
        SELECT * FROM subscriptions
        WHERE user_id = ${userId}
          AND status = '${SubscriptionStatus.ACTIVE}'
        ORDER BY created_at DESC
        LIMIT 1
      `,
        [],
        this.formatter.formatResult.bind(this.formatter),
      );
    } catch (err) {
      return this.handleError(err, 'getting active subscription');
    }
  }

  async searchSubscriptions(
    params: SubscriptionSearchParams,
  ): Promise<{
    subscriptions: Subscription[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const page = params.page ?? 1;
      const limit = params.limit ?? 20;
      const offset = (page - 1) * limit;

      const filters = [];
      if (params.userId)
        filters.push(eq(schema.subscriptions.userId, params.userId));
      if (params.plan)
        filters.push(eq(schema.subscriptions.plan, params.plan));
      if (params.status)
        filters.push(eq(schema.subscriptions.status, params.status));
      if (params.startDate)
        filters.push(gte(schema.subscriptions.startDate, params.startDate));
      if (params.endDate)
        filters.push(lte(schema.subscriptions.endDate, params.endDate));
      if (params.provider)
        filters.push(eq(schema.subscriptions.paymentProvider, params.provider));

      const whereClause = filters.length ? and(...filters) : undefined;

      const [countRow] = await db
        .select({
          count: db.fn.count().mapWith(Number),
        })
        .from(schema.subscriptions)
        .where(whereClause);

      const records = await db.query.subscriptions.findMany({
        where: whereClause,
        limit,
        offset,
        orderBy: desc(schema.subscriptions.createdAt),
      });

      return {
        subscriptions: records.map((r) => this.formatter.formatResult(r)),
        total: countRow?.count ?? 0,
        page,
        limit,
      };
    } catch (err) {
      return this.handleError(err, 'searching subscriptions');
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                         STATE-CHANGE OPERATIONS                            */
  /* -------------------------------------------------------------------------- */

  async cancelSubscription(
    subscriptionId: number,
    reason?: string,
  ): Promise<Subscription> {
    try {
      const sub = await this.getSubscriptionById(subscriptionId);
      if (!sub) throw SubscriptionServiceErrors.SUBSCRIPTION_NOT_FOUND;

      this.validateStatusTransition(sub.status, SubscriptionStatus.CANCELLED);

      const updated = await this.updateSubscription(subscriptionId, {
        status: SubscriptionStatus.CANCELLED,
      });

      // TODO: persist `reason` to an audit table if required.
      return updated;
    } catch (err) {
      return this.handleError(err, 'cancelling subscription');
    }
  }

  async renewSubscription(id: number): Promise<Subscription> {
    try {
      const sub = await this.getSubscriptionById(id);
      if (!sub) throw SubscriptionServiceErrors.SUBSCRIPTION_NOT_FOUND;

      const newEnd = new Date(sub.endDate);
      newEnd.setMonth(newEnd.getMonth() + 1);

      return await this.updateSubscription(id, {
        endDate: newEnd,
        status: SubscriptionStatus.ACTIVE,
      });
    } catch (err) {
      return this.handleError(err, 'renewing subscription');
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                            WEBHOOK / ACCESS                                */
  /* -------------------------------------------------------------------------- */

  async processWebhook(_: ProcessWebhookParams): Promise<boolean> {
    // TODO – real provider-specific webhook handling
    return true;
  }

  async validateSubscriptionAccess(
    userId: number,
    requiredPlan?: SubscriptionPlan | string,
  ): Promise<boolean> {
    const sub = await this.getActiveSubscription(userId);
    if (!sub) return false;
    if (!requiredPlan) return true;
    return sub.plan === requiredPlan;
  }

  /* -------------------------------------------------------------------------- */
  /*                                 METRICS                                    */
  /* -------------------------------------------------------------------------- */

  async getSubscriptionMetrics(): Promise<{
    totalSubscriptions: number;
    activeSubscriptions: number;
    revenueThisMonth: string;
    revenueLastMonth: string;
    subscriptionsByPlan: Record<string, number>;
    churnRate: string;
  }> {
    // These could be optimized into a single SQL query; kept simple for clarity.
    const [totals] = await db
      .select({
        total: db.fn.count().mapWith(Number),
      })
      .from(schema.subscriptions);

    const [active] = await db
      .select({
        total: db.fn.count().mapWith(Number),
      })
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.status, SubscriptionStatus.ACTIVE));

    const plans = await db
      .select({
        plan: schema.subscriptions.plan,
        total: db.fn.count().mapWith(Number),
      })
      .from(schema.subscriptions)
      .groupBy(schema.subscriptions.plan);

    // Placeholder revenue & churn; implement as required.
    return {
      totalSubscriptions: totals?.total ?? 0,
      activeSubscriptions: active?.total ?? 0,
      revenueThisMonth: '0.00',
      revenueLastMonth: '0.00',
      subscriptionsByPlan: Object.fromEntries(
        plans.map((p) => [p.plan as string, p.total]),
      ),
      churnRate: '0.00%',
    };
  }

  /* -------------------------------------------------------------------------- */
  /*                            HELPER UTILITIES                                */
  /* -------------------------------------------------------------------------- */

  private validateStatusTransition(
    current: SubscriptionStatus,
    next: SubscriptionStatus,
  ): void {
    const allowed: Record<SubscriptionStatus, SubscriptionStatus[]> = {
      [SubscriptionStatus.ACTIVE]: [
        SubscriptionStatus.CANCELLED,
        SubscriptionStatus.EXPIRED,
        SubscriptionStatus.PAST_DUE,
      ],
      [SubscriptionStatus.PENDING]: [
        SubscriptionStatus.ACTIVE,
        SubscriptionStatus.CANCELLED,
        SubscriptionStatus.FAILED,
      ],
      [SubscriptionStatus.PAST_DUE]: [
        SubscriptionStatus.ACTIVE,
        SubscriptionStatus.CANCELLED,
        SubscriptionStatus.EXPIRED,
      ],
      [SubscriptionStatus.TRIAL]: [
        SubscriptionStatus.ACTIVE,
        SubscriptionStatus.CANCELLED,
        SubscriptionStatus.EXPIRED,
      ],
      [SubscriptionStatus.EXPIRED]: [SubscriptionStatus.ACTIVE],
      [SubscriptionStatus.CANCELLED]: [SubscriptionStatus.ACTIVE],
      [SubscriptionStatus.FAILED]: [SubscriptionStatus.ACTIVE],
      [SubscriptionStatus.INACTIVE]: [SubscriptionStatus.ACTIVE],
      [SubscriptionStatus.SUSPENDED]: [
        SubscriptionStatus.ACTIVE,
        SubscriptionStatus.CANCELLED,
      ],
    };

    if (
      current === next ||
      !allowed[current]?.includes(next)
    ) {
      throw SubscriptionServiceErrors.INVALID_STATUS_TRANSITION;
    }
  }
}