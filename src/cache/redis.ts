// src/cache/redis.ts
import Redis from 'ioredis';
import { getLogger } from '../logging';

// Get logger for caching operations
const logger = getLogger().child({ component: 'redis-cache' });

// Default cache TTL in seconds (1 hour)
const DEFAULT_TTL = 3600;

// Create Redis client singleton
let redisClient: Redis | null = null;

/**
 * Initialize Redis connection
 * Should be called once at application startup
 */
export function initRedis(): Redis | null {
  if (redisClient) {
    return redisClient;
  }
  
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    logger.warn('REDIS_URL environment variable not set, caching disabled');
    return null;
  }
  
  try {
    logger.info('Initializing Redis connection', { url: redisUrl.replace(/:[^:]*@/, ':***@') });
    
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableOfflineQueue: true,
      connectTimeout: 10000,
      retryStrategy(times) {
        const delay = Math.min(times * 100, 3000);
        logger.debug('Redis connection retry', { attempt: times, delayMs: delay });
        return delay;
      }
    });
    
    // Event listeners
    redisClient.on('connect', () => {
      logger.info('Redis connection established');
    });
    
    redisClient.on('error', (err) => {
      logger.error('Redis connection error', err);
    });
    
    redisClient.on('close', () => {
      logger.warn('Redis connection closed');
    });
    
    return redisClient;
  } catch (error: unknown) {
    logger.error('Failed to initialize Redis', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Get the Redis client instance
 */
export function getRedisClient(): Redis | null {
  return redisClient || initRedis();
}

/**
 * Set a value in the cache
 */
export async function setCacheValue<T>(
  key: string, 
  value: T, 
  ttlSeconds: number = DEFAULT_TTL
): Promise<boolean> {
  const client = getRedisClient();
  if (!client) {
    return false;
  }
  
  try {
    const serializedValue = JSON.stringify(value);
    await client.set(key, serializedValue, 'EX', ttlSeconds);
    
    logger.debug('Cache value set', { key, ttlSeconds });
    return true;
  } catch (error: unknown) {
    logger.error('Error setting cache value', error instanceof Error ? error : new Error(String(error)), { key });
    return false;
  }
}

/**
 * Get a value from the cache
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
    
    logger.debug('Cache hit', { key });
    return JSON.parse(value) as T;
  } catch (error: unknown) {
    logger.error('Error getting cache value', error instanceof Error ? error : new Error(String(error)), { key });
    return null;
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
    await client.del(key);
    logger.debug('Cache value deleted', { key });
    return true;
  } catch (error: unknown) {
    logger.error('Error deleting cache value', error instanceof Error ? error : new Error(String(error)), { key });
    return false;
  }
}

/**
 * Delete multiple values from the cache by pattern
 */
export async function deleteCachePattern(pattern: string): Promise<boolean> {
  const client = getRedisClient();
  if (!client) {
    return false;
  }
  
  try {
    const keys = await client.keys(pattern);
    
    if (keys.length === 0) {
      logger.debug('No keys matched pattern for deletion', { pattern });
      return true;
    }
    
    // Use pipeline for better performance
    const pipeline = client.pipeline();
    keys.forEach(key => pipeline.del(key));
    await pipeline.exec();
    
    logger.debug('Cache values deleted by pattern', { pattern, count: keys.length });
    return true;
  } catch (error: unknown) {
    logger.error('Error deleting cache by pattern', error instanceof Error ? error : new Error(String(error)), { pattern });
    return false;
  }
}

/**
 * Cache decorator for functions/methods
 * Uses function arguments as part of the cache key
 */
export function cacheable<T>(
  keyPrefix: string, 
  ttlSeconds: number = DEFAULT_TTL
) {
  return function(
    target: unknown, 
    propertyKey: string, 
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args: unknown[]) {
      // Generate cache key based on function name, arguments and prefix
      const argsString = JSON.stringify(args);
      const cacheKey = `${keyPrefix}:${propertyKey}:${argsString}`;
      
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
