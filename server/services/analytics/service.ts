import { BaseService } from '../base/service';
import { AnalyticsConfig, AnalyticsServiceErrors, AnalyticsError, defaultAnalyticsConfig } from '../../config/analytics';
import { CacheService } from '../cache/service';
import { Redis } from 'ioredis';
// import { performance } from 'perf_hooks'; // Unused
import { ErrorCode, ErrorCategory } from '@shared/types/errors'; // AppError removed
import { db } from '../../db';
import * as schema from '@shared/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm'; // desc, asc removed

export class AnalyticsService extends BaseService {
  private redis: Redis | undefined;
  private cache: CacheService;
  private config: AnalyticsConfig;
  private aggregationQueue: Array<any>;

  constructor(config: Partial<AnalyticsConfig> = {}) {
    super();
    this.config = { ...defaultAnalyticsConfig, ...config };
    
    if (this.config.storage.type === 'redis' && this.config.storage.connection) {
      this.redis = new Redis(this.config.storage.connection);
    }

    this.cache = new CacheService(this.config.cache);
    this.aggregationQueue = [];

    // Start periodic aggregation
    setInterval(() => this.processAggregationQueue(), this.config.aggregation.window * 1000);
  }

  private generateCacheKey(query: string, params: any): string {
    return `analytics:${query}:${JSON.stringify(params)}`;
  }

  private async validateQuery(query: string, params: any): Promise<void> {
    if (!query) {
      throw AnalyticsServiceErrors.INVALID_QUERY;
    }

    if (params && typeof params !== 'object') {
      throw new AnalyticsError(
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
        await Promise.all(batch.map(async (item: any) => {
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

  private async processAggregation(item: any): Promise<void> {
    try {
      // Implement specific aggregation logic based on item type
      switch (item.type) {
        case 'transaction':
          await this.aggregateTransaction(item.data);
          break;
        case 'user':
          await this.aggregateUser(item.data);
          break;
        case 'product':
          await this.aggregateProduct(item.data);
          break;
        default:
          throw new AnalyticsError(
            'Unknown aggregation type',
            ErrorCode.INVALID_FIELD_VALUE,
            ErrorCategory.VALIDATION
          );
      }
    } catch (error) {
      throw AnalyticsServiceErrors.AGGREGATION_ERROR;
    }
  }

  private async aggregateTransaction(data: any): Promise<void> {
    try {
      // Aggregate transaction metrics
      const metrics = {
        totalAmount: data.amount,
        count: 1,
        timestamp: data.timestamp
      };

      // Store in Redis
      if (this.redis) {
        await this.redis.hincrbyfloat(`metrics:transactions:total`, String(data.storeId), data.amount);
        await this.redis.hincrby(`metrics:transactions:count`, String(data.storeId), 1);
      }

      // Update cache
      await this.cache.set(`metrics:transactions:${data.storeId}`, metrics, this.config.cache.ttl);
    } catch (error) {
      throw AnalyticsServiceErrors.STORAGE_ERROR;
    }
  }

  private async aggregateUser(data: any): Promise<void> {
    try {
      // Aggregate user metrics
      const metrics = {
        totalUsers: 1,
        activeUsers: data.active ? 1 : 0,
        timestamp: data.timestamp
      };

      // Store in Redis
      if (this.redis) {
        await this.redis.hincrby(`metrics:users:total`, String(data.storeId), 1);
        if (data.active) {
          await this.redis.hincrby(`metrics:users:active`, String(data.storeId), 1);
        }
      }

      // Update cache
      await this.cache.set(`metrics:users:${data.storeId}`, metrics, this.config.cache.ttl);
    } catch (error) {
      throw AnalyticsServiceErrors.STORAGE_ERROR;
    }
  }

  private async aggregateProduct(data: any): Promise<void> {
    try {
      // Aggregate product metrics
      const metrics = {
        totalProducts: 1,
        inStock: data.inStock ? 1 : 0,
        outOfStock: !data.inStock ? 1 : 0,
        timestamp: data.timestamp
      };

      // Store in Redis
      if (this.redis) {
        await this.redis.hincrby(`metrics:products:total`, String(data.storeId), 1);
        if (data.inStock) {
          await this.redis.hincrby(`metrics:products:in_stock`, String(data.storeId), 1);
        }
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
  ): Promise<any[]> {
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
        return cached;
      }

      // Query database
      const metrics = await this.withRetry(
        async () => {
          const query = db
            .select({
              date: sql<string>`DATE(${schema.transactions.createdAt})`,
              totalSales: sql<number>`SUM(${schema.transactions.totalAmount})`,
              totalTransactions: sql<number>`COUNT(*)`,
              averageTransaction: sql<number>`AVG(${schema.transactions.totalAmount})`
            })
            .from(schema.transactions)
            .where(
              and(
                eq(schema.transactions.storeId, storeId),
                gte(schema.transactions.createdAt, startDate),
                lte(schema.transactions.createdAt, endDate)
              )
            )
            .groupBy(sql`DATE(${schema.transactions.createdAt})`);

          return query;
        },
        'Getting store metrics'
      );

      // Cache results
      await this.cache.set(cacheKey, metrics, this.config.cache.ttl);

      return metrics;
    } catch (error) {
      return this.handleError(error, 'Getting store metrics');
    }
  }

  async getUserMetrics(
    storeId: number,
    startDate: Date,
    endDate: Date,
    interval: 'day' | 'week' | 'month' = 'day'
  ): Promise<any[]> {
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
        return cached;
      }

      // Query database
      const metrics = await this.withRetry(
        async () => {
          const query = db
            .select({
              date: sql<string>`DATE(${schema.users.createdAt})`,
              totalUsers: sql<number>`COUNT(*)`,
              activeUsers: sql<number>`COUNT(*) filter (where ${schema.users.status} = 'active')`,
              averageTransactions: sql<number>`AVG(
                (SELECT COUNT(*) FROM transactions WHERE transactions.user_id = ${schema.users.id})
              )`
            })
            .from(schema.users)
            .where(
              and(
                eq(schema.users.storeId, storeId),
                gte(schema.users.createdAt, startDate),
                lte(schema.users.createdAt, endDate)
              )
            )
            .groupBy(sql`DATE(${schema.users.createdAt})`);

          return query;
        },
        'Getting user metrics'
      );

      // Cache results
      await this.cache.set(cacheKey, metrics, this.config.cache.ttl);

      return metrics;
    } catch (error) {
      return this.handleError(error, 'Getting user metrics');
    }
  }

  async getProductMetrics(
    storeId: number,
    startDate: Date,
    endDate: Date,
    interval: 'day' | 'week' | 'month' = 'day'
  ): Promise<any[]> {
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
        return cached;
      }

      // Query database
      const metrics = await this.withRetry(
        async () => {
          const query = db
            .select({
              date: sql<string>`DATE(${schema.products.createdAt})`,
              totalProducts: sql<number>`COUNT(*)`,
              inStock: sql<number>`COUNT(*) FILTER (WHERE ${schema.products.quantity} > 0)`,
              outOfStock: sql<number>`COUNT(*) FILTER (WHERE ${schema.products.quantity} = 0)`,
              averagePrice: sql<number>`AVG(${schema.products.price})`
            })
            .from(schema.products)
            .where(
              and(
                eq(schema.products.storeId, storeId),
                gte(schema.products.createdAt, startDate),
                lte(schema.products.createdAt, endDate)
              )
            )
            .groupBy(sql`DATE(${schema.products.createdAt})`);

          return query;
        },
        'Getting product metrics'
      );

      // Cache results
      await this.cache.set(cacheKey, metrics, this.config.cache.ttl);

      return metrics;
    } catch (error) {
      return this.handleError(error, 'Getting product metrics');
    }
  }

  async getLoyaltyMetrics(
    storeId: number,
    startDate: Date,
    endDate: Date,
    interval: 'day' | 'week' | 'month' = 'day'
  ): Promise<any[]> {
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
        return cached;
      }

      // Query database
      const metrics = await this.withRetry(
        async () => {
          const query = db
            .select({
              date: sql<string>`DATE(${schema.loyaltyTransactions.createdAt})`,
              totalPoints: sql<number>`SUM(${schema.loyaltyTransactions.pointsEarned})`,
              totalRedemptions: sql<number>`SUM(${schema.loyaltyTransactions.pointsRedeemed})`,
              activeMembers: sql<number>`COUNT(DISTINCT ${schema.loyaltyMembers.id})`
            })
            .from(schema.loyaltyTransactions)
            .leftJoin(schema.loyalty, eq(schema.loyalty.id, schema.loyaltyTransactions.loyaltyId))
            .where(
              and(
                eq(schema.loyalty.storeId, storeId),
                gte(schema.loyaltyTransactions.createdAt, startDate),
                lte(schema.loyaltyTransactions.createdAt, endDate)
              )
            )
            .groupBy(sql`DATE(${schema.loyaltyTransactions.createdAt})`);

          return query;
        },
        'Getting loyalty metrics'
      );

      // Cache results
      await this.cache.set(cacheKey, metrics, this.config.cache.ttl);

      return metrics;
    } catch (error) {
      return this.handleError(error, 'Getting loyalty metrics');
    }
  }

  async addAggregationToQueue(
    type: string,
    data: any
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

  async clearCache(): Promise<void> {
    try {
      await this.cache.clear();
    } catch (error) {
      throw AnalyticsServiceErrors.CACHE_ERROR;
    }
  }

  async getCacheStats(): Promise<any> {
    try {
      return await this.cache.getStats();
    } catch (error) {
      throw AnalyticsServiceErrors.CACHE_ERROR;
    }
  }
}
