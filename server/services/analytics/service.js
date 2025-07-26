"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsService = void 0;
const base_service_1 = require("../base/base-service");
const analytics_1 = require("../../config/analytics");
const cache_1 = require("../cache");
const ioredis_1 = require("ioredis");
const errors_1 = require("../../../shared/types/errors");
const logger_1 = require("../logger");
const connection_1 = require("../../db/connection");
const schema = __importStar(require("../../../shared/schema"));
const drizzle_orm_1 = require("drizzle-orm");
class AnalyticsService extends base_service_1.BaseService {
    constructor(config = {}) {
        super(logger_1.logger);
        this.config = { ...analytics_1.defaultAnalyticsConfig, ...config };
        this.redis = new ioredis_1.Redis(this.config.storage.connection);
        this.cache = new cache_1.CacheService();
        this.aggregationQueue = [];
        // Start periodic aggregation
        setInterval(() => this.processAggregationQueue(), this.config.aggregation.window * 1000);
    }
    generateCacheKey(query, params) {
        return `analytics:${query}:${JSON.stringify(params)}`;
    }
    async validateQuery(query, params) {
        if (!query) {
            throw analytics_1.AnalyticsServiceErrors.INVALID_QUERY;
        }
        if (params && typeof params !== 'object') {
            throw new errors_1.AppError('Invalid query parameters', errors_1.ErrorCode.INVALID_FIELD_VALUE, errors_1.ErrorCategory.VALIDATION);
        }
    }
    async processAggregationQueue() {
        if (this.aggregationQueue.length === 0)
            return;
        try {
            // Process in batches
            for (let i = 0; i < this.aggregationQueue.length; i += this.config.aggregation.batchSize) {
                const batch = this.aggregationQueue.slice(i, i + this.config.aggregation.batchSize);
                await Promise.all(batch.map(async (item) => {
                    try {
                        await this.processAggregation(item);
                    }
                    catch (error) {
                        console.error('Failed to process aggregation:', error);
                    }
                }));
            }
            this.aggregationQueue = [];
        }
        catch (error) {
            console.error('Failed to process aggregation queue:', error);
        }
    }
    async processAggregation(item) {
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
                    throw new errors_1.AppError('Unknown aggregation type', errors_1.ErrorCode.INVALID_FIELD_VALUE, errors_1.ErrorCategory.VALIDATION);
            }
        }
        catch (error) {
            throw analytics_1.AnalyticsServiceErrors.AGGREGATION_ERROR;
        }
    }
    async aggregateTransaction(data) {
        try {
            // Aggregate transaction metrics
            const metrics = {
                totalAmount: data.amount,
                count: 1,
                timestamp: data.timestamp
            };
            // Store in Redis
            await this.redis.hincrbyfloat(`metrics:transactions:total`, String(data.storeId), data.amount);
            await this.redis.hincrby(`metrics:transactions:count`, String(data.storeId), 1);
            // Update cache
            await this.cache.set(`metrics:transactions:${data.storeId}`, metrics, this.config.cache.ttl);
        }
        catch (error) {
            throw analytics_1.AnalyticsServiceErrors.STORAGE_ERROR;
        }
    }
    async aggregateUser(data) {
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
        }
        catch (error) {
            throw analytics_1.AnalyticsServiceErrors.STORAGE_ERROR;
        }
    }
    async aggregateProduct(data) {
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
        }
        catch (error) {
            throw analytics_1.AnalyticsServiceErrors.STORAGE_ERROR;
        }
    }
    async getStoreMetrics(storeId, startDate, endDate, interval = 'day') {
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
            const metrics = await this.withRetry(async () => {
                const query = connection_1.db
                    .select({
                    date: (0, drizzle_orm_1.sql) `DATE(${schema.transactions.createdAt})`.as('date'),
                    totalSales: (0, drizzle_orm_1.sql) `SUM(${schema.transactions.total})`.as('totalSales'),
                    totalTransactions: (0, drizzle_orm_1.sql) `COUNT(*)`.as('totalTransactions'),
                    averageTransaction: (0, drizzle_orm_1.sql) `AVG(${schema.transactions.total})`.as('averageTransaction')
                })
                    .from(schema.transactions)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.transactions.storeId, storeId), (0, drizzle_orm_1.gte)(schema.transactions.createdAt, startDate), (0, drizzle_orm_1.lte)(schema.transactions.createdAt, endDate)))
                    .groupBy((0, drizzle_orm_1.sql) `DATE(${schema.transactions.createdAt})`)
                    .orderBy((0, drizzle_orm_1.asc)((0, drizzle_orm_1.sql) `DATE(${schema.transactions.createdAt})`));
                return query;
            }, 'Getting store metrics');
            // Cache results
            await this.cache.set(cacheKey, metrics, this.config.cache.ttl);
            return metrics;
        }
        catch (error) {
            throw this.handleError(error, 'Getting store metrics');
        }
    }
    async getUserMetrics(storeId, startDate, endDate, interval = 'day') {
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
            const metrics = await this.withRetry(async () => {
                const query = connection_1.db
                    .select({
                    date: (0, drizzle_orm_1.sql) `DATE(${schema.users.createdAt})`.as('date'),
                    totalUsers: (0, drizzle_orm_1.sql) `COUNT(*)`.as('totalUsers'),
                    activeUsers: (0, drizzle_orm_1.sql) `COUNT(*) filter (where ${schema.users.isActive} = true)`.as('activeUsers'),
                    averageTransactions: (0, drizzle_orm_1.sql) `AVG((SELECT COUNT(*) FROM ${schema.transactions} WHERE ${schema.transactions.userId} = ${schema.users.id}))`.as('averageTransactions')
                })
                    .from(schema.users)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.users.storeId, storeId), (0, drizzle_orm_1.gte)(schema.users.createdAt, startDate), (0, drizzle_orm_1.lte)(schema.users.createdAt, endDate)))
                    .groupBy((0, drizzle_orm_1.sql) `DATE(${schema.users.createdAt})`)
                    .orderBy((0, drizzle_orm_1.asc)((0, drizzle_orm_1.sql) `DATE(${schema.users.createdAt})`));
                return query;
            }, 'Getting user metrics');
            // Cache results
            await this.cache.set(cacheKey, metrics, this.config.cache.ttl);
            return metrics;
        }
        catch (error) {
            throw this.handleError(error, 'Getting user metrics');
        }
    }
    async getProductMetrics(storeId, startDate, endDate, interval = 'day') {
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
            const metrics = await this.withRetry(async () => {
                const query = connection_1.db
                    .select({
                    date: (0, drizzle_orm_1.sql) `DATE(${schema.products.createdAt})`.as('date'),
                    totalProducts: (0, drizzle_orm_1.sql) `COUNT(*)`.as('totalProducts'),
                    inStock: (0, drizzle_orm_1.sql) `COUNT(*) FILTER (WHERE ${schema.inventory.quantity} > 0)`.as('inStock'),
                    outOfStock: (0, drizzle_orm_1.sql) `COUNT(*) FILTER (WHERE ${schema.inventory.quantity} = 0)`.as('outOfStock'),
                    averagePrice: (0, drizzle_orm_1.sql) `AVG(${schema.products.price})`.as('averagePrice')
                })
                    .from(schema.products)
                    .leftJoin(schema.inventory, (0, drizzle_orm_1.eq)(schema.products.id, schema.inventory.productId))
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.gte)(schema.products.createdAt, startDate), (0, drizzle_orm_1.lte)(schema.products.createdAt, endDate)))
                    .groupBy((0, drizzle_orm_1.sql) `DATE(${schema.products.createdAt})`)
                    .orderBy((0, drizzle_orm_1.asc)((0, drizzle_orm_1.sql) `DATE(${schema.products.createdAt})`));
                return query;
            }, 'Getting product metrics');
            // Cache results
            await this.cache.set(cacheKey, metrics, this.config.cache.ttl);
            return metrics;
        }
        catch (error) {
            throw this.handleError(error, 'Getting product metrics');
        }
    }
    async getLoyaltyMetrics(storeId, startDate, endDate, interval = 'day') {
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
            const metrics = await this.withRetry(async () => {
                const query = connection_1.db
                    .select({
                    date: (0, drizzle_orm_1.sql) `DATE(${schema.loyaltyTransactions.createdAt})`.as('date'),
                    totalPoints: (0, drizzle_orm_1.sql) `SUM(${schema.loyaltyTransactions.pointsEarned})`.as('totalPoints'),
                    totalRedemptions: (0, drizzle_orm_1.sql) `SUM(${schema.loyaltyTransactions.pointsRedeemed})`.as('totalRedemptions'),
                    activeMembers: (0, drizzle_orm_1.sql) `COUNT(DISTINCT ${schema.loyaltyTransactions.memberId})`.as('activeMembers')
                })
                    .from(schema.loyaltyTransactions)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.gte)(schema.loyaltyTransactions.createdAt, startDate), (0, drizzle_orm_1.lte)(schema.loyaltyTransactions.createdAt, endDate)))
                    .groupBy((0, drizzle_orm_1.sql) `DATE(${schema.loyaltyTransactions.createdAt})`)
                    .orderBy((0, drizzle_orm_1.asc)((0, drizzle_orm_1.sql) `DATE(${schema.loyaltyTransactions.createdAt})`));
                return query;
            }, 'Getting loyalty metrics');
            // Cache results
            await this.cache.set(cacheKey, metrics, this.config.cache.ttl);
            return metrics;
        }
        catch (error) {
            throw this.handleError(error, 'Getting loyalty metrics');
        }
    }
    async addAggregationToQueue(type, data) {
        try {
            this.aggregationQueue.push({ type, data });
            if (this.aggregationQueue.length >= this.config.aggregation.batchSize) {
                await this.processAggregationQueue();
            }
        }
        catch (error) {
            throw analytics_1.AnalyticsServiceErrors.AGGREGATION_ERROR;
        }
    }
    async clearCache(userId) {
        try {
            await this.cache.clear(userId);
        }
        catch (error) {
            throw analytics_1.AnalyticsServiceErrors.CACHE_ERROR;
        }
    }
    async getCacheStats(userId) {
        try {
            return await this.cache.getUsageStats(userId);
        }
        catch (error) {
            throw analytics_1.AnalyticsServiceErrors.CACHE_ERROR;
        }
    }
    handleError(error, context) {
        if (error instanceof errors_1.AppError) {
            throw error;
        }
        throw new errors_1.AppError(`Failed when ${context}`, errors_1.ErrorCode.INTERNAL_SERVER_ERROR, errors_1.ErrorCategory.SYSTEM, { originalError: error });
    }
    async withRetry(operation, context, maxRetries = 3, delay = 1000) {
        let lastError;
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await operation();
            }
            catch (error) {
                lastError = error;
                await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
            }
        }
        throw this.handleError(lastError, context);
    }
}
exports.AnalyticsService = AnalyticsService;
