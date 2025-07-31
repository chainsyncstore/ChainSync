// src/cache/enhanced-redis.ts
import Redis from 'ioredis';
import { getLogger } from '../logging/index.js';

const logger = getLogger().child({ component: 'enhanced-redis-cache' });

// Cache configuration
const CACHE_CONFIG = {
  TTL: {
    USER_SESSION: 86400,
    PRODUCT_CATALOG: 3600,
    ANALYTICS_DATA: 1800,
    API_RESPONSE: 300,
    QUERY_RESULT: 600,
    STATIC_DATA: 7200,
  },
  PREFIXES: {
    USER: 'user',
    PRODUCT: 'product',
    ANALYTICS: 'analytics',
    API: 'api',
    QUERY: 'query',
    SESSION: 'session',
    RATE_LIMIT: 'rate_limit',
  }
};

let redisClient: Redis | null = null;

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
      maxRetriesPerRequest: 3,
      enableOfflineQueue: true,
      connectTimeout: 10000,
      commandTimeout: 5000,
      retryStrategy(times) {
        const delay = Math.min(times * 100, 3000);
        return delay;
      },
      lazyConnect: true,
      keepAlive: 30000,
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
  key: string, 
  value: T, 
  ttlSeconds: number = CACHE_CONFIG.TTL.API_RESPONSE
): Promise<boolean> {
  const client = getEnhancedRedisClient();
  if (!client) {
    return false;
  }
  
  try {
    const cacheEntry = {
      data: value,
      metadata: {
        timestamp: Date.now(),
        ttl: ttlSeconds,
      }
    };
    
    const serializedValue = JSON.stringify(cacheEntry);
    await client.set(key, serializedValue, 'EX', ttlSeconds);
    
    logger.debug('Enhanced cache value set', { key, ttlSeconds });
    return true;
  } catch (error) {
    logger.error('Error setting enhanced cache value', error instanceof Error ? error : new Error(String(error)), { key });
    return false;
  }
}

export async function getEnhancedCacheValue<T>(key: string): Promise<T | null> {
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
    logger.error('Error getting enhanced cache value', error instanceof Error ? error : new Error(String(error)), { key });
    return null;
  }
}

export { CACHE_CONFIG }; 