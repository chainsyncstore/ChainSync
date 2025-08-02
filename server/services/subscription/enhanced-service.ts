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
  SchemaValidationError
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
  ISubscriptionService,
  SubscriptionServiceErrors
} from './types';

import { db } from '@server/db';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import * as schema from '@shared/schema';
import { SelectSubscription } from '@shared/schema';

export class EnhancedSubscriptionService
  extends EnhancedBaseService
  implements ISubscriptionService
{
  private readonly formatter = new SubscriptionFormatter();

  /* -------------------------------------------------------------------------- */
  /*                               CRUD METHODS                                 */
  /* -------------------------------------------------------------------------- */

  async createSubscription(
    _params: CreateSubscriptionParams
  ): Promise<SelectSubscription> {
    try {
      const validated = subscriptionValidation.insert.parse(params);
      const data = prepareSubscriptionData(validated);

      const [subscription] = await db
        .insert(schema.subscriptions)
        .values(data as any)
        .returning();

      return this.ensureExists(subscription, 'Subscription');
    } catch (err) {
      if (err instanceof SchemaValidationError) {
        console.error(`Validation _error: ${err.message}`, err.toJSON());
      }
      throw this.handleError(err as Error, 'creating subscription');
    }
  }

  async updateSubscription(
    _subscriptionId: number,
    _params: UpdateSubscriptionParams
  ): Promise<SelectSubscription> {
    try {
      const existing = await this.getSubscriptionById(subscriptionId);
      if (!existing) throw SubscriptionServiceErrors.SUBSCRIPTION_NOT_FOUND;

      if (params.status && params.status !== existing.status) {
        this.validateStatusTransition(existing.status as SubscriptionStatus, params.status);
      }

      const updateData = {
        ...params,
        _metadata: params.metadata
          ? JSON.stringify(params.metadata)
          : existing.metadata,
        _updatedAt: new Date()
      };

      const validated = subscriptionValidation.update.parse(updateData);
      const prepared = prepareSubscriptionData(validated);

      const [updated] = await db
        .update(schema.subscriptions)
        .set(prepared as any)
        .where(eq(schema.subscriptions.id, subscriptionId))
        .returning();

      return this.ensureExists(updated, 'Subscription');
    } catch (err) {
      throw this.handleError(err as Error, 'updating subscription');
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                               READ METHODS                                 */
  /* -------------------------------------------------------------------------- */

  async getSubscriptionById(_id: number): Promise<SelectSubscription | null> {
    try {
      const subscription = await db.query.subscriptions.findFirst({
        _where: eq(schema.subscriptions.id, id)
      });
      return subscription ? this.formatter.formatResult(subscription) : null;
    } catch (err) {
      throw this.handleError(err as Error, 'getting subscription by ID');
    }
  }

  async getSubscriptionByUser(_userId: number): Promise<SelectSubscription | null> {
    try {
      const subscription = await db.query.subscriptions.findFirst({
        _where: eq(schema.subscriptions.userId, userId),
        _orderBy: desc(schema.subscriptions.createdAt)
      });
      return subscription ? this.formatter.formatResult(subscription) : null;
    } catch (err) {
      throw this.handleError(err as Error, 'getting subscription by user');
    }
  }

  async getActiveSubscription(_userId: number): Promise<SelectSubscription | null> {
    try {
      const subscription = await db.query.subscriptions.findFirst({
        _where: and(
          eq(schema.subscriptions.userId, userId),
          eq(schema.subscriptions.status, 'active')
        ),
        _orderBy: desc(schema.subscriptions.createdAt)
      });
      return subscription ? this.formatter.formatResult(subscription) : null;
    } catch (err) {
      throw this.handleError(err as Error, 'getting active subscription');
    }
  }

  async searchSubscriptions(
    _params: SubscriptionSearchParams
  ): Promise<{
    _subscriptions: SelectSubscription[];
    _total: number;
    _page: number;
    _limit: number;
  }> {
    try {
      const page = params.page ?? 1;
      const limit = params.limit ?? 20;
      const offset = (page - 1) * limit;

      const filters = [];
      if (params.userId)
        filters.push(eq(schema.subscriptions.userId, params.userId));
      if (params.plan)
        filters.push(eq(schema.subscriptions.planId, params.plan));
      if (params.status)
        filters.push(eq(schema.subscriptions.status, params.status as 'active' | 'cancelled' | 'expired'));
      if (params.startDate)
        filters.push(gte(schema.subscriptions.currentPeriodStart, params.startDate));
      if (params.endDate)
        filters.push(lte(schema.subscriptions.currentPeriodEnd, params.endDate));
      if (params.provider)
        filters.push(eq(schema.subscriptions.paymentMethod, params.provider));

      const whereClause = filters.length ? and(...filters) : undefined;

      const countResult = await db
        .select({
          _count: sql<number>`count(*)`.mapWith(Number)
        })
        .from(schema.subscriptions)
        .where(whereClause);

      const records = await db.query.subscriptions.findMany({
        _where: whereClause,
        limit,
        offset,
        _orderBy: desc(schema.subscriptions.createdAt)
      });

      return {
        _subscriptions: records.map((r) => this.formatter.formatResult(r)),
        _total: countResult[0]?.count ?? 0,
        page,
        limit
      };
    } catch (err) {
      throw this.handleError(err as Error, 'searching subscriptions');
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                         STATE-CHANGE OPERATIONS                            */
  /* -------------------------------------------------------------------------- */

  async cancelSubscription(
    _subscriptionId: number,
    reason?: string
  ): Promise<SelectSubscription> {
    try {
      const sub = await this.getSubscriptionById(subscriptionId);
      if (!sub) throw SubscriptionServiceErrors.SUBSCRIPTION_NOT_FOUND;

      this.validateStatusTransition(sub.status as SubscriptionStatus, SubscriptionStatus.CANCELLED);

      const updated = await this.updateSubscription(subscriptionId, {
        _status: SubscriptionStatus.CANCELLED
      });

      // _TODO: persist `reason` to an audit table if required.
      return updated;
    } catch (err) {
      throw this.handleError(err as Error, 'cancelling subscription');
    }
  }

  async renewSubscription(_id: number): Promise<SelectSubscription> {
    try {
      const sub = await this.getSubscriptionById(id);
      if (!sub) throw SubscriptionServiceErrors.SUBSCRIPTION_NOT_FOUND;

      const newEnd = new Date(sub.endDate as Date);
      newEnd.setMonth(newEnd.getMonth() + 1);

      return await this.updateSubscription(id, {
        _endDate: newEnd,
        _status: SubscriptionStatus.ACTIVE
      });
    } catch (err) {
      throw this.handleError(err as Error, 'renewing subscription');
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
    _userId: number,
    requiredPlan?: SubscriptionPlan | string
  ): Promise<boolean> {
    const sub = await this.getActiveSubscription(userId);
    if (!sub) return false;
    if (!requiredPlan) return true;
    return sub.planId === requiredPlan;
  }

  /* -------------------------------------------------------------------------- */
  /*                                 METRICS                                    */
  /* -------------------------------------------------------------------------- */

  async getSubscriptionMetrics(): Promise<{
    _totalSubscriptions: number;
    _activeSubscriptions: number;
    _revenueThisMonth: string;
    _revenueLastMonth: string;
    _subscriptionsByPlan: Record<string, number>;
    _churnRate: string;
  }> {
    // These could be optimized into a single SQL query; kept simple for clarity.
    const [totals] = await db
      .select({
        _total: sql<number>`count(*)`.mapWith(Number)
      })
      .from(schema.subscriptions);

    const [active] = await db
      .select({
        _total: sql<number>`count(*)`.mapWith(Number)
      })
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.status, 'active'));

    const plans = await db
      .select({
        _plan: schema.subscriptions.planId,
        _total: sql<number>`count(*)`.mapWith(Number)
      })
      .from(schema.subscriptions)
      .groupBy(schema.subscriptions.planId);

    // Placeholder revenue & churn; implement as required.
    return {
      _totalSubscriptions: totals?.total ?? 0,
      _activeSubscriptions: active?.total ?? 0,
      _revenueThisMonth: '0.00',
      _revenueLastMonth: '0.00',
      _subscriptionsByPlan: Object.fromEntries(
        plans.map((p) => [p.plan as string, p.total])
      ),
      _churnRate: '0.00%'
    };
  }

  /* -------------------------------------------------------------------------- */
  /*                            HELPER UTILITIES                                */
  /* -------------------------------------------------------------------------- */

  private validateStatusTransition(
    _current: SubscriptionStatus,
    _next: SubscriptionStatus
  ): void {
    const _allowed: Record<SubscriptionStatus, SubscriptionStatus[]> = {
      [SubscriptionStatus.ACTIVE]: [
        SubscriptionStatus.CANCELLED,
        SubscriptionStatus.EXPIRED,
        SubscriptionStatus.PAST_DUE
      ],
      [SubscriptionStatus.PENDING]: [
        SubscriptionStatus.ACTIVE,
        SubscriptionStatus.CANCELLED,
        SubscriptionStatus.FAILED
      ],
      [SubscriptionStatus.PAST_DUE]: [
        SubscriptionStatus.ACTIVE,
        SubscriptionStatus.CANCELLED,
        SubscriptionStatus.EXPIRED
      ],
      [SubscriptionStatus.TRIAL]: [
        SubscriptionStatus.ACTIVE,
        SubscriptionStatus.CANCELLED,
        SubscriptionStatus.EXPIRED
      ],
      [SubscriptionStatus.EXPIRED]: [SubscriptionStatus.ACTIVE],
      [SubscriptionStatus.CANCELLED]: [SubscriptionStatus.ACTIVE],
      [SubscriptionStatus.FAILED]: [SubscriptionStatus.ACTIVE],
      [SubscriptionStatus.INACTIVE]: [SubscriptionStatus.ACTIVE],
      [SubscriptionStatus.SUSPENDED]: [
        SubscriptionStatus.ACTIVE,
        SubscriptionStatus.CANCELLED
      ]
    };

    if (
      current === next ||
      !allowed[current]?.includes(next)
    ) {
      throw SubscriptionServiceErrors.INVALID_STATUS_TRANSITION;
    }
  }
}
