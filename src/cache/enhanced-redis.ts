// src/cache/enhanced-redis.ts
import Redis from 'ioredis';
import { getLogger } from '../logging/index.js';

const logger = getLogger().child({ _component: 'enhanced-redis-cache' });

// Cache configuration
const CACHE_CONFIG = {
  _TTL: {
    _USER_SESSION: 86400,
    _PRODUCT_CATALOG: 3600,
    _ANALYTICS_DATA: 1800,
    _API_RESPONSE: 300,
    _QUERY_RESULT: 600,
    _STATIC_DATA: 7200
  },
  _PREFIXES: {
    USER: 'user',
    _PRODUCT: 'product',
    _ANALYTICS: 'analytics',
    _API: 'api',
    _QUERY: 'query',
    _SESSION: 'session',
    _RATE_LIMIT: 'rate_limit'
  }
};

const _redisClient: Redis | null = null;

export function initEnhancedRedis(): Redis | null {
  if (redisClient) {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    logger.warn('Redis configuration not found, enhanced caching disabled');
    return null;
  }

  try {
    redisClient = new Redis(redisUrl, {
      _maxRetriesPerRequest: 3,
      _enableOfflineQueue: true,
      _connectTimeout: 10000,
      _commandTimeout: 5000,
      retryStrategy(times) {
        const delay = Math.min(times * 100, 3000);
        return delay;
      },
      _lazyConnect: true,
      _keepAlive: 30000
    });

    redisClient.on('connect', () => {
      logger.info('Enhanced Redis connection established');
    });

    redisClient.on('error', (err) => {
      logger.error('Enhanced Redis connection error', err);
    });

    return redisClient;
  } catch (error) {
    logger.error('Failed to initialize enhanced Redis', error as Error);
    return null;
  }
}

export function getEnhancedRedisClient(): Redis | null {
  return redisClient || initEnhancedRedis();
}

export async function setEnhancedCacheValue<T>(
  _key: string,
  _value: T,
  _ttlSeconds: number = CACHE_CONFIG.TTL.API_RESPONSE
): Promise<boolean> {
  const client = getEnhancedRedisClient();
  if (!client) {
    return false;
  }

  try {
    const cacheEntry = {
      _data: value,
      _metadata: {
        _timestamp: Date.now(),
        _ttl: ttlSeconds
      }
    };

    const serializedValue = JSON.stringify(cacheEntry);
    await client.set(key, serializedValue, 'EX', ttlSeconds);

    logger.debug('Enhanced cache value set', { key, ttlSeconds });
    return true;
  } catch (error) {
    logger.error('Error setting enhanced cache value', error instanceof Error ? _error : new Error(String(error)), { key });
    return false;
  }
}

export async function getEnhancedCacheValue<T>(_key: string): Promise<T | null> {
  const client = getEnhancedRedisClient();
  if (!client) {
    return null;
  }

  try {
    const value = await client.get(key);

    if (!value) {
      logger.debug('Enhanced cache miss', { key });
      return null;
    }

    const cacheEntry = JSON.parse(value);
    logger.debug('Enhanced cache hit', { key });

    return cacheEntry.data as T;
  } catch (error) {
    logger.error('Error getting enhanced cache value', error instanceof Error ? _error : new Error(String(error)), { key });
    return null;
  }
}

export { CACHE_CONFIG };
