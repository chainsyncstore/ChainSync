// src/cache/redis.ts
import Redis from 'ioredis';
import { getLogger } from '../logging/index.js';

// Get logger for caching operations
const logger = getLogger().child({ component: 'redis-cache' });

// Default cache TTL in seconds (1 hour)
const DEFAULT_TTL = 3600;

// Cache configuration
const CACHE_CONFIG = {
  // Different TTLs for different data types
  TTL: {
    USER_SESSION: 86400, // 24 hours
    PRODUCT_CATALOG: 3600, // 1 hour
    ANALYTICS_DATA: 1800, // 30 minutes
    API_RESPONSE: 300, // 5 minutes
    QUERY_RESULT: 600, // 10 minutes
    STATIC_DATA: 7200, // 2 hours
  },
  // Cache key prefixes for organization
  PREFIXES: {
    USER: 'user',
    PRODUCT: 'product',
    ANALYTICS: 'analytics',
    API: 'api',
    QUERY: 'query',
    SESSION: 'session',
    RATE_LIMIT: 'rate_limit',
  },
  // Connection pool settings
  POOL: {
    MAX_CONNECTIONS: parseInt(process.env.REDIS_MAX_CONNECTIONS || '10'),
    MIN_CONNECTIONS: parseInt(process.env.REDIS_MIN_CONNECTIONS || '2'),
    CONNECTION_TIMEOUT: 10000,
    COMMAND_TIMEOUT: 5000,
  }
};

// Create Redis client singleton with connection pooling
let redisClient: Redis | null = null;
let redisCluster: Redis.Cluster | null = null;

/**
 * Initialize Redis connection with advanced configuration
 * Supports both single instance and cluster modes
 */
export function initRedis(): Redis | Redis.Cluster | null {
  if (redisClient || redisCluster) {
    return redisClient || redisCluster;
  }
  
  const redisUrl = process.env.REDIS_URL;
  const redisClusterNodes = process.env.REDIS_CLUSTER_NODES;
  
  if (!redisUrl && !redisClusterNodes) {
    logger.warn('Redis configuration not found, caching disabled');
    return null;
  }
  
  try {
    if (redisClusterNodes) {
      // Cluster mode
      const nodes = redisClusterNodes.split(',').map(node => node.trim());
      logger.info('Initializing Redis cluster connection', { nodeCount: nodes.length });
      
      redisCluster = new Redis.Cluster(nodes, {
        maxRetriesPerRequest: 3,
        enableOfflineQueue: true,
        connectTimeout: CACHE_CONFIG.POOL.CONNECTION_TIMEOUT,
        commandTimeout: CACHE_CONFIG.POOL.COMMAND_TIMEOUT,
        retryDelayOnFailover: 100,
        retryDelayOnClusterDown: 300,
        retryDelayOnTryAgain: 100,
        scaleReads: 'slave', // Read from replicas for better performance
        redisOptions: {
          password: process.env.REDIS_PASSWORD,
          db: parseInt(process.env.REDIS_DB || '0'),
        }
      });
      
      setupRedisEventListeners(redisCluster, 'cluster');
      return redisCluster;
    } else {
      // Single instance mode
      logger.info('Initializing Redis single instance connection', { 
        url: redisUrl?.replace(/:[^:]*@/, ':***@') 
      });
      
      redisClient = new Redis(redisUrl!, {
        maxRetriesPerRequest: 3,
        enableOfflineQueue: true,
        connectTimeout: CACHE_CONFIG.POOL.CONNECTION_TIMEOUT,
        commandTimeout: CACHE_CONFIG.POOL.COMMAND_TIMEOUT,
        retryStrategy(times) {
          const delay = Math.min(times * 100, 3000);
          logger.debug('Redis connection retry', { attempt: times, delayMs: delay });
          return delay;
        },
        lazyConnect: true, // Don't connect immediately
        keepAlive: 30000, // Keep connection alive
        family: 4, // Force IPv4
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
      });
      
      setupRedisEventListeners(redisClient, 'single');
      return redisClient;
    }
  } catch (error) {
    logger.error('Failed to initialize Redis', error as Error);
    return null;
  }
}

/**
 * Setup Redis event listeners for monitoring and debugging
 */
function setupRedisEventListeners(client: Redis | Redis.Cluster, mode: 'single' | 'cluster') {
  client.on('connect', () => {
    logger.info(`Redis ${mode} connection established`);
  });
  
  client.on('ready', () => {
    logger.info(`Redis ${mode} client ready`);
  });
  
  client.on('error', (err) => {
    logger.error(`Redis ${mode} connection error`, err);
  });
  
  client.on('close', () => {
    logger.warn(`Redis ${mode} connection closed`);
  });
  
  client.on('reconnecting', () => {
    logger.info(`Redis ${mode} reconnecting`);
  });
  
  if (mode === 'cluster') {
    (client as Redis.Cluster).on('node:connect', (node) => {
      logger.debug('Redis cluster node connected', { node: node.options.host });
    });
    
    (client as Redis.Cluster).on('node:error', (err, node) => {
      logger.error('Redis cluster node error', { error: err.message, node: node.options.host });
    });
  }
}

/**
 * Get the Redis client instance
 */
export function getRedisClient(): Redis | Redis.Cluster | null {
  return redisClient || redisCluster || initRedis();
}

/**
 * Enhanced cache value setter with compression and metadata
 */
export async function setCacheValue<T>(
  key: string, 
  value: T, 
  ttlSeconds: number = DEFAULT_TTL,
  options: {
    compress?: boolean;
    metadata?: Record<string, any>;
  } = {}
): Promise<boolean> {
  const client = getRedisClient();
  if (!client) {
    return false;
  }
  
  try {
    const cacheEntry = {
      data: value,
      metadata: {
        timestamp: Date.now(),
        ttl: ttlSeconds,
        ...options.metadata
      }
    };
    
    const serializedValue = JSON.stringify(cacheEntry);
    
    // Use pipeline for better performance
    const pipeline = client.pipeline();
    pipeline.set(key, serializedValue, 'EX', ttlSeconds);
    
    // Set metadata for cache management
    if (options.metadata) {
      pipeline.hset(`${key}:meta`, options.metadata);
      pipeline.expire(`${key}:meta`, ttlSeconds);
    }
    
    await pipeline.exec();
    
    logger.debug('Cache value set', { key, ttlSeconds, compressed: options.compress });
    return true;
  } catch (error) {
    logger.error('Error setting cache value', error instanceof Error ? error : new Error(String(error)), { key });
    return false;
  }
}

/**
 * Enhanced cache value getter with metadata
 */
export async function getCacheValue<T>(key: string): Promise<T | null> {
  const client = getRedisClient();
  if (!client) {
    return null;
  }
  
  try {
    const value = await client.get(key);
    
    if (!value) {
      logger.debug('Cache miss', { key });
      return null;
    }
    
    const cacheEntry = JSON.parse(value);
    logger.debug('Cache hit', { key, age: Date.now() - cacheEntry.metadata.timestamp });
    
    return cacheEntry.data as T;
  } catch (error) {
    logger.error('Error getting cache value', error instanceof Error ? error : new Error(String(error)), { key });
    return null;
  }
}

/**
 * Batch cache operations for better performance
 */
export async function setCacheValuesBatch<T>(
  entries: Array<{ key: string; value: T; ttl?: number }>
): Promise<number> {
  const client = getRedisClient();
  if (!client) {
    return 0;
  }
  
  try {
    const pipeline = client.pipeline();
    
    entries.forEach(({ key, value, ttl = DEFAULT_TTL }) => {
      const cacheEntry = {
        data: value,
        metadata: {
          timestamp: Date.now(),
          ttl
        }
      };
      const serializedValue = JSON.stringify(cacheEntry);
      pipeline.set(key, serializedValue, 'EX', ttl);
    });
    
    const results = await pipeline.exec();
    const successCount = results?.filter(result => result[0] === null).length || 0;
    
    logger.debug('Batch cache set completed', { total: entries.length, success: successCount });
    return successCount;
  } catch (error) {
    logger.error('Error in batch cache set', error instanceof Error ? error : new Error(String(error)));
    return 0;
  }
}

/**
 * Batch cache retrieval for better performance
 */
export async function getCacheValuesBatch<T>(keys: string[]): Promise<Map<string, T>> {
  const client = getRedisClient();
  if (!client) {
    return new Map();
  }
  
  try {
    const values = await client.mget(...keys);
    const result = new Map<string, T>();
    
    keys.forEach((key, index) => {
      const value = values[index];
      if (value) {
        try {
          const cacheEntry = JSON.parse(value);
          result.set(key, cacheEntry.data as T);
        } catch (parseError) {
          logger.warn('Failed to parse cached value', { key, error: parseError });
        }
      }
    });
    
    logger.debug('Batch cache get completed', { requested: keys.length, found: result.size });
    return result;
  } catch (error) {
    logger.error('Error in batch cache get', error instanceof Error ? error : new Error(String(error)));
    return new Map();
  }
}

/**
 * Delete a value from the cache
 */
export async function deleteCacheValue(key: string): Promise<boolean> {
  const client = getRedisClient();
  if (!client) {
    return false;
  }
  
  try {
    const pipeline = client.pipeline();
    pipeline.del(key);
    pipeline.del(`${key}:meta`);
    await pipeline.exec();
    
    logger.debug('Cache value deleted', { key });
    return true;
  } catch (error) {
    logger.error('Error deleting cache value', error instanceof Error ? error : new Error(String(error)), { key });
    return false;
  }
}

/**
 * Delete multiple values from the cache by pattern
 */
export async function deleteCachePattern(pattern: string): Promise<number> {
  const client = getRedisClient();
  if (!client) {
    return 0;
  }
  
  try {
    const keys = await client.keys(pattern);
    
    if (keys.length === 0) {
      logger.debug('No keys matched pattern for deletion', { pattern });
      return 0;
    }
    
    // Use pipeline for better performance
    const pipeline = client.pipeline();
    keys.forEach(key => {
      pipeline.del(key);
      pipeline.del(`${key}:meta`);
    });
    
    const results = await pipeline.exec();
    const deletedCount = results?.filter(result => result[0] === null).length || 0;
    
    logger.debug('Cache values deleted by pattern', { pattern, count: deletedCount });
    return deletedCount;
  } catch (error) {
    logger.error('Error deleting cache by pattern', error instanceof Error ? error : new Error(String(error)), { pattern });
    return 0;
  }
}

/**
 * Cache invalidation strategies
 */
export class CacheInvalidator {
  /**
   * Invalidate all cache entries for a specific user
   */
  static async invalidateUserCache(userId: string): Promise<number> {
    const patterns = [
      `${CACHE_CONFIG.PREFIXES.USER}:${userId}:*`,
      `${CACHE_CONFIG.PREFIXES.SESSION}:${userId}:*`,
    ];
    
    let totalDeleted = 0;
    for (const pattern of patterns) {
      totalDeleted += await deleteCachePattern(pattern);
    }
    
    logger.info('User cache invalidated', { userId, deletedCount: totalDeleted });
    return totalDeleted;
  }
  
  /**
   * Invalidate all cache entries for a specific product
   */
  static async invalidateProductCache(productId: string): Promise<number> {
    const patterns = [
      `${CACHE_CONFIG.PREFIXES.PRODUCT}:${productId}:*`,
      `${CACHE_CONFIG.PREFIXES.ANALYTICS}:product:${productId}:*`,
    ];
    
    let totalDeleted = 0;
    for (const pattern of patterns) {
      totalDeleted += await deleteCachePattern(pattern);
    }
    
    logger.info('Product cache invalidated', { productId, deletedCount: totalDeleted });
    return totalDeleted;
  }
  
  /**
   * Invalidate all analytics cache
   */
  static async invalidateAnalyticsCache(): Promise<number> {
    const pattern = `${CACHE_CONFIG.PREFIXES.ANALYTICS}:*`;
    const deletedCount = await deleteCachePattern(pattern);
    
    logger.info('Analytics cache invalidated', { deletedCount });
    return deletedCount;
  }
}

/**
 * Advanced cache decorator with TTL and invalidation support
 */
export function cacheable<T>(
  keyPrefix: string, 
  ttlSeconds: number = DEFAULT_TTL,
  options: {
    invalidateOn?: string[];
    keyGenerator?: (...args: any[]) => string;
  } = {}
) {
  return function(
    target: any, 
    propertyKey: string, 
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args: any[]) {
      // Generate cache key
      const keyGenerator = options.keyGenerator || ((...args: any[]) => {
        const argsString = JSON.stringify(args);
        return `${keyPrefix}:${propertyKey}:${argsString}`;
      });
      
      const cacheKey = keyGenerator(...args);
      
      // Try to get from cache first
      const cachedValue = await getCacheValue<T>(cacheKey);
      if (cachedValue !== null) {
        return cachedValue;
      }
      
      // Call the original method if not in cache
      const result = await originalMethod.apply(this, args);
      
      // Cache the result
      await setCacheValue<T>(cacheKey, result, ttlSeconds);
      
      return result;
    };
    
    return descriptor;
  };
}

/**
 * Cache warming utilities
 */
export class CacheWarmer {
  /**
   * Warm up cache with frequently accessed data
   */
  static async warmCache<T>(
    dataProvider: () => Promise<Array<{ key: string; value: T }>>,
    ttlSeconds: number = DEFAULT_TTL
  ): Promise<number> {
    try {
      const data = await dataProvider();
      const entries = data.map(({ key, value }) => ({ key, value, ttl: ttlSeconds }));
      
      const successCount = await setCacheValuesBatch(entries);
      logger.info('Cache warming completed', { total: data.length, success: successCount });
      
      return successCount;
    } catch (error) {
      logger.error('Cache warming failed', error instanceof Error ? error : new Error(String(error)));
      return 0;
    }
  }
  
  /**
   * Schedule periodic cache warming
   */
  static scheduleCacheWarming<T>(
    dataProvider: () => Promise<Array<{ key: string; value: T }>>,
    intervalMinutes: number = 60,
    ttlSeconds: number = DEFAULT_TTL
  ): NodeJS.Timeout {
    const intervalMs = intervalMinutes * 60 * 1000;
    
    const warmCache = async () => {
      await this.warmCache(dataProvider, ttlSeconds);
    };
    
    // Initial warming
    warmCache();
    
    // Schedule periodic warming
    return setInterval(warmCache, intervalMs);
  }
}

/**
 * Cache statistics and monitoring
 */
export class CacheStats {
  static async getStats(): Promise<{
    totalKeys: number;
    memoryUsage: string;
    hitRate: number;
    connected: boolean;
  }> {
    const client = getRedisClient();
    if (!client) {
      return {
        totalKeys: 0,
        memoryUsage: '0',
        hitRate: 0,
        connected: false
      };
    }
    
    try {
      const pipeline = client.pipeline();
      pipeline.dbsize();
      pipeline.info('memory');
      
      const results = await pipeline.exec();
      const [dbsizeResult, memoryResult] = results || [];
      
      const totalKeys = dbsizeResult?.[1] as number || 0;
      const memoryInfo = memoryResult?.[1] as string || '';
      
      // Parse memory usage from Redis info
      const usedMemoryMatch = memoryInfo.match(/used_memory_human:(\S+)/);
      const memoryUsage = usedMemoryMatch?.[1] || '0';
      
      return {
        totalKeys,
        memoryUsage,
        hitRate: 0, // Would need to implement hit tracking
        connected: true
      };
    } catch (error) {
      logger.error('Error getting cache stats', error instanceof Error ? error : new Error(String(error)));
      return {
        totalKeys: 0,
        memoryUsage: '0',
        hitRate: 0,
        connected: false
      };
    }
  }
}

// Export configuration for external use
export { CACHE_CONFIG };
