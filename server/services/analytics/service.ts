import { BaseService } from '../base/base-service';
import { AnalyticsConfig, AnalyticsServiceErrors, defaultAnalyticsConfig } from '../../config/analytics';
import { CacheService } from '../cache';
import { Redis } from 'ioredis';
import { AppError, ErrorCode, ErrorCategory } from '../../../shared/types/errors';
import { logger } from '../logger';
import { db } from '../../db/connection';
import * as schema from '../../../shared/schema';
import { eq, and, gte, lte, sql, desc, asc } from 'drizzle-orm';

export class AnalyticsService extends BaseService {
  private redis: Redis;
  private cache: CacheService;
  private config: AnalyticsConfig;
  private aggregationQueue: Array<Record<string, unknown>>;

  constructor(config: Partial<AnalyticsConfig> = {}) {
    super(logger);
    this.config = { ...defaultAnalyticsConfig, ...config };
    this.redis = new Redis(this.config.storage.connection as string);
    this.cache = new CacheService();
    this.aggregationQueue = [];

    // Start periodic aggregation
    setInterval(() => this.processAggregationQueue(), this.config.aggregation.window * 1000);
  }

  private generateCacheKey(query: string, params: Record<string, unknown>): string {
    return `analytics:${query}:${JSON.stringify(params)}`;
  }

  private async validateQuery(query: string, params: Record<string, unknown>): Promise<void> {
    if (!query) {
      throw AnalyticsServiceErrors.INVALID_QUERY;
    }

    if (params && typeof params !== 'object') {
      throw new AppError(
        'Invalid query parameters',
        ErrorCode.INVALID_FIELD_VALUE,
        ErrorCategory.VALIDATION
      );
    }
  }

  private async processAggregationQueue(): Promise<void> {
    if (this.aggregationQueue.length === 0) return;

    try {
      // Process in batches
      for (let i = 0; i < this.aggregationQueue.length; i += this.config.aggregation.batchSize) {
        const batch = this.aggregationQueue.slice(i, i + this.config.aggregation.batchSize);
        await Promise.all(batch.map(async (item: Record<string, unknown>) => {
          try {
            await this.processAggregation(item);
          } catch (error) {
            console.error('Failed to process aggregation:', error);
          }
        }));
      }

      this.aggregationQueue = [];
    } catch (error) {
      console.error('Failed to process aggregation queue:', error);
    }
  }

  private async processAggregation(item: Record<string, unknown>): Promise<void> {
    try {
      // Implement specific aggregation logic based on item type
      switch (item.type) {
        case 'transaction':
          await this.aggregateTransaction(item.data as Record<string, unknown>);
          break;
        case 'user':
          await this.aggregateUser(item.data as Record<string, unknown>);
          break;
        case 'product':
          await this.aggregateProduct(item.data as Record<string, unknown>);
          break;
        default:
          throw new AppError(
            'Unknown aggregation type',
            ErrorCode.INVALID_FIELD_VALUE,
            ErrorCategory.VALIDATION
          );
      }
    } catch (error) {
      throw AnalyticsServiceErrors.AGGREGATION_ERROR;
    }
  }

  private async aggregateTransaction(data: Record<string, unknown>): Promise<void> {
    try {
      // Aggregate transaction metrics
      const metrics = {
        totalAmount: data.amount,
        count: 1,
        timestamp: data.timestamp
      };

      // Store in Redis
      await this.redis.hincrbyfloat(`metrics:transactions:total`, String(data.storeId), data.amount as number);
      await this.redis.hincrby(`metrics:transactions:count`, String(data.storeId), 1);

      // Update cache
      await this.cache.set(`metrics:transactions:${data.storeId}`, metrics, this.config.cache.ttl);
    } catch (error) {
      throw AnalyticsServiceErrors.STORAGE_ERROR;
    }
  }

  private async aggregateUser(data: Record<string, unknown>): Promise<void> {
    try {
      // Aggregate user metrics
      const metrics = {
        totalUsers: 1,
        activeUsers: data.active ? 1 : 0,
        timestamp: data.timestamp
      };

      // Store in Redis
      await this.redis.hincrby(`metrics:users:total`, String(data.storeId), 1);
      if (data.active) {
        await this.redis.hincrby(`metrics:users:active`, String(data.storeId), 1);
      }

      // Update cache
      await this.cache.set(`metrics:users:${data.storeId}`, metrics, this.config.cache.ttl);
    } catch (error) {
      throw AnalyticsServiceErrors.STORAGE_ERROR;
    }
  }

  private async aggregateProduct(data: Record<string, unknown>): Promise<void> {
    try {
      // Aggregate product metrics
      const metrics = {
        totalProducts: 1,
        inStock: data.inStock ? 1 : 0,
        outOfStock: !data.inStock ? 1 : 0,
        timestamp: data.timestamp
      };

      // Store in Redis
      await this.redis.hincrby(`metrics:products:total`, String(data.storeId), 1);
      if (data.inStock) {
        await this.redis.hincrby(`metrics:products:in_stock`, String(data.storeId), 1);
      }

      // Update cache
      await this.cache.set(`metrics:products:${data.storeId}`, metrics, this.config.cache.ttl);
    } catch (error) {
      throw AnalyticsServiceErrors.STORAGE_ERROR;
    }
  }

  async getStoreMetrics(
    storeId: number,
    startDate: Date,
    endDate: Date,
    interval: 'day' | 'week' | 'month' = 'day'
  ): Promise<Record<string, unknown>[]> {
    try {
      // Validate query
      await this.validateQuery('store_metrics', { storeId, startDate, endDate, interval });

      // Generate cache key
      const cacheKey = this.generateCacheKey('store_metrics', {
        storeId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        interval
      });

      // Check cache
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached as Record<string, unknown>[];
      }

      // Query database
      const metrics = await this.withRetry(
        async () => {
          const query = db
            .select({
              date: sql<string>`DATE(${schema.transactions.createdAt})`.as('date'),
              totalSales: sql<number>`SUM(${schema.transactions.total})`.as('totalSales'),
              totalTransactions: sql<number>`COUNT(*)`.as('totalTransactions'),
              averageTransaction: sql<number>`AVG(${schema.transactions.total})`.as('averageTransaction')
            })
            .from(schema.transactions)
            .where(
              and(
                eq(schema.transactions.storeId, storeId),
                gte(schema.transactions.createdAt, startDate),
                lte(schema.transactions.createdAt, endDate)
              )
            )
            .groupBy(sql`DATE(${schema.transactions.createdAt})`)
            .orderBy(asc(sql`DATE(${schema.transactions.createdAt})`));

          return query;
        },
        'Getting store metrics'
      );

      // Cache results
      await this.cache.set(cacheKey, metrics, this.config.cache.ttl);

      return metrics;
    } catch (error) {
      throw this.handleError(error, 'Getting store metrics');
    }
  }

  async getUserMetrics(
    storeId: number,
    startDate: Date,
    endDate: Date,
    interval: 'day' | 'week' | 'month' = 'day'
  ): Promise<Record<string, unknown>[]> {
    try {
      // Validate query
      await this.validateQuery('user_metrics', { storeId, startDate, endDate, interval });

      // Generate cache key
      const cacheKey = this.generateCacheKey('user_metrics', {
        storeId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        interval
      });

      // Check cache
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached as Record<string, unknown>[];
      }

      // Query database
      const metrics = await this.withRetry(
        async () => {
          const query = db
            .select({
              date: sql<string>`DATE(${schema.users.createdAt})`.as('date'),
              totalUsers: sql<number>`COUNT(*)`.as('totalUsers'),
              activeUsers: sql<number>`COUNT(*) filter (where ${schema.users.isActive} = true)`.as('activeUsers'),
              averageTransactions: sql<number>`AVG((SELECT COUNT(*) FROM ${schema.transactions} WHERE ${schema.transactions.userId} = ${schema.users.id}))`.as('averageTransactions')
            })
            .from(schema.users)
            .where(
              and(
                eq(schema.users.storeId, storeId),
                gte(schema.users.createdAt, startDate),
                lte(schema.users.createdAt, endDate)
              )
            )
            .groupBy(sql`DATE(${schema.users.createdAt})`)
            .orderBy(asc(sql`DATE(${schema.users.createdAt})`));

          return query;
        },
        'Getting user metrics'
      );

      // Cache results
      await this.cache.set(cacheKey, metrics, this.config.cache.ttl);

      return metrics;
    } catch (error) {
      throw this.handleError(error, 'Getting user metrics');
    }
  }

  async getProductMetrics(
    storeId: number,
    startDate: Date,
    endDate: Date,
    interval: 'day' | 'week' | 'month' = 'day'
  ): Promise<Record<string, unknown>[]> {
    try {
      // Validate query
      await this.validateQuery('product_metrics', { storeId, startDate, endDate, interval });

      // Generate cache key
      const cacheKey = this.generateCacheKey('product_metrics', {
        storeId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        interval
      });

      // Check cache
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached as Record<string, unknown>[];
      }

      // Query database
      const metrics = await this.withRetry(
        async () => {
          const query = db
            .select({
              date: sql<string>`DATE(${schema.products.createdAt})`.as('date'),
              totalProducts: sql<number>`COUNT(*)`.as('totalProducts'),
              inStock: sql<number>`COUNT(*) FILTER (WHERE ${schema.inventory.quantity} > 0)`.as('inStock'),
              outOfStock: sql<number>`COUNT(*) FILTER (WHERE ${schema.inventory.quantity} = 0)`.as('outOfStock'),
              averagePrice: sql<number>`AVG(${schema.products.price})`.as('averagePrice')
            })
            .from(schema.products)
            .leftJoin(schema.inventory, eq(schema.products.id, schema.inventory.productId))
            .where(
              and(
                gte(schema.products.createdAt, startDate),
                lte(schema.products.createdAt, endDate)
              )
            )
            .groupBy(sql`DATE(${schema.products.createdAt})`)
            .orderBy(asc(sql`DATE(${schema.products.createdAt})`));

          return query;
        },
        'Getting product metrics'
      );

      // Cache results
      await this.cache.set(cacheKey, metrics, this.config.cache.ttl);

      return metrics;
    } catch (error) {
      throw this.handleError(error, 'Getting product metrics');
    }
  }

  async getLoyaltyMetrics(
    storeId: number,
    startDate: Date,
    endDate: Date,
    interval: 'day' | 'week' | 'month' = 'day'
  ): Promise<Record<string, unknown>[]> {
    try {
      // Validate query
      await this.validateQuery('loyalty_metrics', { storeId, startDate, endDate, interval });

      // Generate cache key
      const cacheKey = this.generateCacheKey('loyalty_metrics', {
        storeId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        interval
      });

      // Check cache
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached as Record<string, unknown>[];
      }

      // Query database
      const metrics = await this.withRetry(
        async () => {
          const query = db
            .select({
              date: sql<string>`DATE(${schema.loyaltyTransactions.createdAt})`.as('date'),
              totalPoints: sql<number>`SUM(${schema.loyaltyTransactions.pointsEarned})`.as('totalPoints'),
              totalRedemptions: sql<number>`SUM(${schema.loyaltyTransactions.pointsRedeemed})`.as('totalRedemptions'),
              activeMembers: sql<number>`COUNT(DISTINCT ${schema.loyaltyTransactions.memberId})`.as('activeMembers')
            })
            .from(schema.loyaltyTransactions)
            .where(
              and(
                gte(schema.loyaltyTransactions.createdAt, startDate),
                lte(schema.loyaltyTransactions.createdAt, endDate)
              )
            )
            .groupBy(sql`DATE(${schema.loyaltyTransactions.createdAt})`)
            .orderBy(asc(sql`DATE(${schema.loyaltyTransactions.createdAt})`));

          return query;
        },
        'Getting loyalty metrics'
      );

      // Cache results
      await this.cache.set(cacheKey, metrics, this.config.cache.ttl);

      return metrics;
    } catch (error) {
      throw this.handleError(error, 'Getting loyalty metrics');
    }
  }

  async addAggregationToQueue(
    type: string,
    data: Record<string, unknown>
  ): Promise<void> {
    try {
      this.aggregationQueue.push({ type, data });
      if (this.aggregationQueue.length >= this.config.aggregation.batchSize) {
        await this.processAggregationQueue();
      }
    } catch (error) {
      throw AnalyticsServiceErrors.AGGREGATION_ERROR;
    }
  }

  async clearCache(userId: string): Promise<void> {
    try {
      await this.cache.clear(userId);
    } catch (error) {
      throw AnalyticsServiceErrors.CACHE_ERROR;
    }
  }

  async getCacheStats(userId: string): Promise<Record<string, unknown> | null> {
    try {
      return await this.cache.getUsageStats(userId);
    } catch (error) {
      throw AnalyticsServiceErrors.CACHE_ERROR;
    }
  }

  protected handleError(error: unknown, context: string): never {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      `Failed when ${context}`,
      ErrorCode.INTERNAL_SERVER_ERROR,
      ErrorCategory.SYSTEM,
      { originalError: error }
    );
  }

  private async withRetry<T>(
    operation: () => Promise<T>,
    context: string,
    maxRetries = 3,
    delay = 1000
  ): Promise<T> {
    let lastError: unknown;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
      }
    }
    throw this.handleError(lastError, context);
  }
}
