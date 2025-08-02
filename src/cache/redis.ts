// src/cache/redis.ts
import Redis, { Cluster } from 'ioredis';
import { getLogger } from '../logging/index.js';

// Get logger for caching operations
const logger = getLogger().child({ _component: 'redis-cache' });

// Default cache TTL in seconds (1 hour)
const DEFAULT_TTL = 3600;

// Cache configuration
const CACHE_CONFIG = {
  // Different TTLs for different data types
  _TTL: {
    _USER_SESSION: 86400, // 24 hours
    _PRODUCT_CATALOG: 3600, // 1 hour
    _ANALYTICS_DATA: 1800, // 30 minutes
    _API_RESPONSE: 300, // 5 minutes
    _QUERY_RESULT: 600, // 10 minutes
    _STATIC_DATA: 7200 // 2 hours
  },
  // Cache key prefixes for organization
  _PREFIXES: {
    USER: 'user',
    _PRODUCT: 'product',
    _ANALYTICS: 'analytics',
    _API: 'api',
    _QUERY: 'query',
    _SESSION: 'session',
    _RATE_LIMIT: 'rate_limit'
  },
  // Connection pool settings
  _POOL: {
    _MAX_CONNECTIONS: parseInt(process.env.REDIS_MAX_CONNECTIONS || '10'),
    _MIN_CONNECTIONS: parseInt(process.env.REDIS_MIN_CONNECTIONS || '2'),
    _CONNECTION_TIMEOUT: 10000,
    _COMMAND_TIMEOUT: 5000
  }
};

// Create Redis client singleton with connection pooling
const _redisClient: Redis | null = null;
const _redisCluster: Cluster | null = null;

/**
 * Initialize Redis connection with advanced configuration
 * Supports both single instance and cluster modes
 */
export function initRedis(): Redis | Cluster | null {
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
      logger.info('Initializing Redis cluster connection', { _nodeCount: nodes.length });

      redisCluster = new Cluster(nodes, {
        _enableOfflineQueue: true,
        _retryDelayOnFailover: 100,
        _retryDelayOnClusterDown: 300,
        _retryDelayOnTryAgain: 100,
        _scaleReads: 'slave', // Read from replicas for better performance
        _redisOptions: {
          ...(process.env.REDIS_PASSWORD && { _password: process.env.REDIS_PASSWORD }),
          _db: parseInt(process.env.REDIS_DB || '0'),
          _connectTimeout: CACHE_CONFIG.POOL.CONNECTION_TIMEOUT,
          _commandTimeout: CACHE_CONFIG.POOL.COMMAND_TIMEOUT
        }
      });

      setupRedisEventListeners(redisCluster, 'cluster');
      return redisCluster;
    } else {
      // Single instance mode
      logger.info('Initializing Redis single instance connection', {
        _url: redisUrl?.replace(/:[^:]*@/, ':***@')
      });

      redisClient = new Redis(redisUrl!, {
        _maxRetriesPerRequest: 3,
        _enableOfflineQueue: true,
        _connectTimeout: CACHE_CONFIG.POOL.CONNECTION_TIMEOUT,
        _commandTimeout: CACHE_CONFIG.POOL.COMMAND_TIMEOUT,
        retryStrategy(times) {
          const delay = Math.min(times * 100, 3000);
          logger.debug('Redis connection retry', { _attempt: times, _delayMs: delay });
          return delay;
        },
        _lazyConnect: true, // Don't connect immediately
        _keepAlive: 30000, // Keep connection alive
        _family: 4, // Force IPv4
        ...(process.env.REDIS_PASSWORD && { _password: process.env.REDIS_PASSWORD }),
        _db: parseInt(process.env.REDIS_DB || '0')
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
function setupRedisEventListeners(_client: Redis | Cluster, _mode: 'single' | 'cluster') {
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
    (client as Cluster).on('_node:connect', (node) => {
      logger.debug('Redis cluster node connected', { _node: node.options.host });
    });

    (client as Cluster).on('_node:error', (err, node) => {
      logger.error('Redis cluster node error', { _error: err.message, _node: node.options.host });
    });
  }
}

/**
 * Get the Redis client instance
 */
export function getRedisClient(): Redis | Cluster | null {
  return redisClient || redisCluster || initRedis();
}

/**
 * Enhanced cache value setter with compression and metadata
 */
export async function setCacheValue<T>(
  _key: string,
  _value: T,
  _ttlSeconds: number = DEFAULT_TTL,
  _options: {
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
      _data: value,
      _metadata: {
        _timestamp: Date.now(),
        _ttl: ttlSeconds,
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

    logger.debug('Cache value set', { key, ttlSeconds, _compressed: options.compress });
    return true;
  } catch (error) {
    logger.error('Error setting cache value', error instanceof Error ? _error : new Error(String(error)), { key });
    return false;
  }
}

/**
 * Enhanced cache value getter with metadata
 */
export async function getCacheValue<T>(_key: string): Promise<T | null> {
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
    logger.debug('Cache hit', { key, _age: Date.now() - cacheEntry.metadata.timestamp });

    return cacheEntry.data as T;
  } catch (error) {
    logger.error('Error getting cache value', error instanceof Error ? _error : new Error(String(error)), { key });
    return null;
  }
}

/**
 * Batch cache operations for better performance
 */
export async function setCacheValuesBatch<T>(
  _entries: Array<{ _key: string; _value: T; ttl?: number }>
): Promise<number> {
  const client = getRedisClient();
  if (!client) {
    return 0;
  }

  try {
    const pipeline = client.pipeline();

    entries.forEach(({ key, value, ttl = DEFAULT_TTL }) => {
      const cacheEntry = {
        _data: value,
        _metadata: {
          _timestamp: Date.now(),
          ttl
        }
      };
      const serializedValue = JSON.stringify(cacheEntry);
      pipeline.set(key, serializedValue, 'EX', ttl);
    });

    const results = await pipeline.exec();
    const successCount = results?.filter(result => result[0] === null).length || 0;

    logger.debug('Batch cache set completed', { _total: entries.length, _success: successCount });
    return successCount;
  } catch (error) {
    logger.error('Error in batch cache set', error instanceof Error ? _error : new Error(String(error)));
    return 0;
  }
}

/**
 * Batch cache retrieval for better performance
 */
export async function getCacheValuesBatch<T>(_keys: string[]): Promise<Map<string, T>> {
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
          logger.warn('Failed to parse cached value', { key, _error: parseError });
        }
      }
    });

    logger.debug('Batch cache get completed', { _requested: keys.length, _found: result.size });
    return result;
  } catch (error) {
    logger.error('Error in batch cache get', error instanceof Error ? _error : new Error(String(error)));
    return new Map();
  }
}

/**
 * Delete a value from the cache
 */
export async function deleteCacheValue(_key: string): Promise<boolean> {
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
    logger.error('Error deleting cache value', error instanceof Error ? _error : new Error(String(error)), { key });
    return false;
  }
}

/**
 * Delete multiple values from the cache by pattern
 */
export async function deleteCachePattern(_pattern: string): Promise<number> {
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

    logger.debug('Cache values deleted by pattern', { pattern, _count: deletedCount });
    return deletedCount;
  } catch (error) {
    logger.error('Error deleting cache by pattern', error instanceof Error ? _error : new Error(String(error)), { pattern });
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
  static async invalidateUserCache(_userId: string): Promise<number> {
    const patterns = [
      `${CACHE_CONFIG.PREFIXES.USER}:${userId}:*`,
      `${CACHE_CONFIG.PREFIXES.SESSION}:${userId}:*`
    ];

    let totalDeleted = 0;
    for (const pattern of patterns) {
      totalDeleted += await deleteCachePattern(pattern);
    }

    logger.info('User cache invalidated', { userId, _deletedCount: totalDeleted });
    return totalDeleted;
  }

  /**
   * Invalidate all cache entries for a specific product
   */
  static async invalidateProductCache(_productId: string): Promise<number> {
    const patterns = [
      `${CACHE_CONFIG.PREFIXES.PRODUCT}:${productId}:*`,
      `${CACHE_CONFIG.PREFIXES.ANALYTICS}:product:${productId}:*`
    ];

    let totalDeleted = 0;
    for (const pattern of patterns) {
      totalDeleted += await deleteCachePattern(pattern);
    }

    logger.info('Product cache invalidated', { productId, _deletedCount: totalDeleted });
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
  _keyPrefix: string,
  _ttlSeconds: number = DEFAULT_TTL,
  _options: {
    invalidateOn?: string[];
    keyGenerator?: (..._args: any[]) => string;
  } = {}
) {
  return function(
    _target: any,
    _propertyKey: string,
    _descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function(..._args: any[]) {
      // Generate cache key
      const keyGenerator = options.keyGenerator || ((..._args: any[]) => {
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
    _dataProvider: () => Promise<Array<{ _key: string; _value: T }>>,
    _ttlSeconds: number = DEFAULT_TTL
  ): Promise<number> {
    try {
      const data = await dataProvider();
      const entries = data.map(({ key, value }) => ({ key, value, _ttl: ttlSeconds }));

      const successCount = await setCacheValuesBatch(entries);
      logger.info('Cache warming completed', { _total: data.length, _success: successCount });

      return successCount;
    } catch (error) {
      logger.error('Cache warming failed', error instanceof Error ? _error : new Error(String(error)));
      return 0;
    }
  }

  /**
   * Schedule periodic cache warming
   */
  static scheduleCacheWarming<T>(
    _dataProvider: () => Promise<Array<{ _key: string; _value: T }>>,
    _intervalMinutes: number = 60,
    _ttlSeconds: number = DEFAULT_TTL
  ): NodeJS.Timeout {
    const intervalMs = intervalMinutes * 60 * 1000;

    const warmCache = async() => {
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
    _totalKeys: number;
    _memoryUsage: string;
    _hitRate: number;
    _connected: boolean;
  }> {
    const client = getRedisClient();
    if (!client) {
      return {
        _totalKeys: 0,
        _memoryUsage: '0',
        _hitRate: 0,
        _connected: false
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
        _hitRate: 0, // Would need to implement hit tracking
        _connected: true
      };
    } catch (error) {
      logger.error('Error getting cache stats', error instanceof Error ? _error : new Error(String(error)));
      return {
        _totalKeys: 0,
        _memoryUsage: '0',
        _hitRate: 0,
        _connected: false
      };
    }
  }
}

// Export configuration for external use
export { CACHE_CONFIG };
