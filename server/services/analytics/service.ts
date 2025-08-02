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
  private _redis: Redis;
  private _cache: CacheService;
  private _config: AnalyticsConfig;
  private _aggregationQueue: Array<Record<string, unknown>>;

  constructor(_config: Partial<AnalyticsConfig> = {}) {
    super(logger);
    this.config = { ...defaultAnalyticsConfig, ...config };
    this.redis = new Redis(this.config.storage.connection as string);
    this.cache = new CacheService();
    this.aggregationQueue = [];

    // Start periodic aggregation
    setInterval(() => this.processAggregationQueue(), this.config.aggregation.window * 1000);
  }

  private generateCacheKey(_query: string, _params: Record<string, unknown>): string {
    return `analytics:${query}:${JSON.stringify(params)}`;
  }

  private async validateQuery(_query: string, _params: Record<string, unknown>): Promise<void> {
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
        await Promise.all(batch.map(async(_item: Record<string, unknown>) => {
          try {
            await this.processAggregation(item);
          } catch (error) {
            console.error('Failed to process _aggregation:', error);
          }
        }));
      }

      this.aggregationQueue = [];
    } catch (error) {
      console.error('Failed to process aggregation _queue:', error);
    }
  }

  private async processAggregation(_item: Record<string, unknown>): Promise<void> {
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

  private async aggregateTransaction(_data: Record<string, unknown>): Promise<void> {
    try {
      // Aggregate transaction metrics
      const metrics = {
        _totalAmount: data.amount,
        _count: 1,
        _timestamp: data.timestamp
      };

      // Store in Redis
      await this.redis.hincrbyfloat('_metrics:transactions:total', String(data.storeId), data.amount as number);
      await this.redis.hincrby('_metrics:transactions:count', String(data.storeId), 1);

      // Update cache
      await this.cache.set(`_metrics:transactions:${data.storeId}`, metrics, this.config.cache.ttl);
    } catch (error) {
      throw AnalyticsServiceErrors.STORAGE_ERROR;
    }
  }

  private async aggregateUser(_data: Record<string, unknown>): Promise<void> {
    try {
      // Aggregate user metrics
      const metrics = {
        _totalUsers: 1,
        _activeUsers: data.active ? _1 : 0,
        _timestamp: data.timestamp
      };

      // Store in Redis
      await this.redis.hincrby('_metrics:users:total', String(data.storeId), 1);
      if (data.active) {
        await this.redis.hincrby('_metrics:users:active', String(data.storeId), 1);
      }

      // Update cache
      await this.cache.set(`_metrics:users:${data.storeId}`, metrics, this.config.cache.ttl);
    } catch (error) {
      throw AnalyticsServiceErrors.STORAGE_ERROR;
    }
  }

  private async aggregateProduct(_data: Record<string, unknown>): Promise<void> {
    try {
      // Aggregate product metrics
      const metrics = {
        _totalProducts: 1,
        _inStock: data.inStock ? _1 : 0,
        _outOfStock: !data.inStock ? _1 : 0,
        _timestamp: data.timestamp
      };

      // Store in Redis
      await this.redis.hincrby('_metrics:products:total', String(data.storeId), 1);
      if (data.inStock) {
        await this.redis.hincrby('_metrics:products:in_stock', String(data.storeId), 1);
      }

      // Update cache
      await this.cache.set(`_metrics:products:${data.storeId}`, metrics, this.config.cache.ttl);
    } catch (error) {
      throw AnalyticsServiceErrors.STORAGE_ERROR;
    }
  }

  async getStoreMetrics(
    _storeId: number,
    _startDate: Date,
    _endDate: Date,
    _interval: 'day' | 'week' | 'month' = 'day'
  ): Promise<Record<string, unknown>[]> {
    try {
      // Validate query
      await this.validateQuery('store_metrics', { storeId, startDate, endDate, interval });

      // Generate cache key
      const cacheKey = this.generateCacheKey('store_metrics', {
        storeId,
        _startDate: startDate.toISOString(),
        _endDate: endDate.toISOString(),
        interval
      });

      // Check cache
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached as Record<string, unknown>[];
      }

      // Query database
      const metrics = await this.withRetry(
        async() => {
          const query = db
            .select({
              _date: sql<string>`DATE(${schema.transactions.createdAt})`.as('date'),
              _totalSales: sql<number>`SUM(${schema.transactions.total})`.as('totalSales'),
              _totalTransactions: sql<number>`COUNT(*)`.as('totalTransactions'),
              _averageTransaction: sql<number>`AVG(${schema.transactions.total})`.as('averageTransaction')
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
    _storeId: number,
    _startDate: Date,
    _endDate: Date,
    _interval: 'day' | 'week' | 'month' = 'day'
  ): Promise<Record<string, unknown>[]> {
    try {
      // Validate query
      await this.validateQuery('user_metrics', { storeId, startDate, endDate, interval });

      // Generate cache key
      const cacheKey = this.generateCacheKey('user_metrics', {
        storeId,
        _startDate: startDate.toISOString(),
        _endDate: endDate.toISOString(),
        interval
      });

      // Check cache
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached as Record<string, unknown>[];
      }

      // Query database
      const metrics = await this.withRetry(
        async() => {
          const query = db
            .select({
              _date: sql<string>`DATE(${schema.users.createdAt})`.as('date'),
              _totalUsers: sql<number>`COUNT(*)`.as('totalUsers'),
              _activeUsers: sql<number>`COUNT(*) filter (where ${schema.users.isActive}
   =  true)`.as('activeUsers'),
              _averageTransactions: sql<number>`AVG((SELECT COUNT(*) FROM ${schema.transactions} WHERE ${schema.transactions.userId}
   =  ${schema.users.id}))`.as('averageTransactions')
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
    _storeId: number,
    _startDate: Date,
    _endDate: Date,
    _interval: 'day' | 'week' | 'month' = 'day'
  ): Promise<Record<string, unknown>[]> {
    try {
      // Validate query
      await this.validateQuery('product_metrics', { storeId, startDate, endDate, interval });

      // Generate cache key
      const cacheKey = this.generateCacheKey('product_metrics', {
        storeId,
        _startDate: startDate.toISOString(),
        _endDate: endDate.toISOString(),
        interval
      });

      // Check cache
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached as Record<string, unknown>[];
      }

      // Query database
      const metrics = await this.withRetry(
        async() => {
          const query = db
            .select({
              _date: sql<string>`DATE(${schema.products.createdAt})`.as('date'),
              _totalProducts: sql<number>`COUNT(*)`.as('totalProducts'),
              _inStock: sql<number>`COUNT(*) FILTER (WHERE ${schema.inventory.quantity} > 0)`.as('inStock'),
              _outOfStock: sql<number>`COUNT(*) FILTER (WHERE ${schema.inventory.quantity}
   =  0)`.as('outOfStock'),
              _averagePrice: sql<number>`AVG(${schema.products.price})`.as('averagePrice')
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
    _storeId: number,
    _startDate: Date,
    _endDate: Date,
    _interval: 'day' | 'week' | 'month' = 'day'
  ): Promise<Record<string, unknown>[]> {
    try {
      // Validate query
      await this.validateQuery('loyalty_metrics', { storeId, startDate, endDate, interval });

      // Generate cache key
      const cacheKey = this.generateCacheKey('loyalty_metrics', {
        storeId,
        _startDate: startDate.toISOString(),
        _endDate: endDate.toISOString(),
        interval
      });

      // Check cache
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached as Record<string, unknown>[];
      }

      // Query database
      const metrics = await this.withRetry(
        async() => {
          const query = db
            .select({
              _date: sql<string>`DATE(${schema.loyaltyTransactions.createdAt})`.as('date'),
              _totalPoints: sql<number>`SUM(${schema.loyaltyTransactions.pointsEarned})`.as('totalPoints'),
              _totalRedemptions: sql<number>`SUM(${schema.loyaltyTransactions.pointsRedeemed})`.as('totalRedemptions'),
              _activeMembers: sql<number>`COUNT(DISTINCT ${schema.loyaltyTransactions.memberId})`.as('activeMembers')
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
    _type: string,
    _data: Record<string, unknown>
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

  async clearCache(_userId: string): Promise<void> {
    try {
      await this.cache.clear(userId);
    } catch (error) {
      throw AnalyticsServiceErrors.CACHE_ERROR;
    }
  }

  async getCacheStats(_userId: string): Promise<Record<string, unknown> | null> {
    try {
      return await this.cache.getUsageStats(userId);
    } catch (error) {
      throw AnalyticsServiceErrors.CACHE_ERROR;
    }
  }

  protected handleError(_error: unknown, _context: string): never {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      `Failed when ${context}`,
      ErrorCode.INTERNAL_SERVER_ERROR,
      ErrorCategory.SYSTEM,
      { _originalError: error }
    );
  }

  private async withRetry<T>(
    _operation: () => Promise<T>,
    _context: string,
    maxRetries = 3,
    delay = 1000
  ): Promise<T> {
    let _lastError: unknown;
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
