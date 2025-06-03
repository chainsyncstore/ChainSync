/**
 * Cache Service
 * 
 * A standardized service for caching data using Redis
 */

import { RedisClientType } from 'redis';
import { Logger } from '../../../src/logging'; // Use logger from src

interface CacheServiceConfig {
  redis: RedisClientType;
  logger: Logger;
}

/**
 * Cache service for managing Redis-based caching
 */
export class CacheService {
  private readonly redis: RedisClientType;
  private readonly logger: Logger;
  private readonly defaultTtl: number = 3600; // 1 hour in seconds
  
  constructor(config: CacheServiceConfig) {
    this.redis = config.redis;
    this.logger = config.logger;
    this.logger.info('Cache service initialized');
  }
  
  /**
   * Get cached value by key
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      if (!value) return null;
      
      return JSON.parse(value as string) as T;
    } catch (error) {
      this.logger.error('Error getting cached value', { key, error });
      return null;
    }
  }
  
  /**
   * Set cache value with optional TTL
   */
  async set<T>(key: string, value: T, ttlSeconds: number = this.defaultTtl): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      await this.redis.set(key, serialized, { EX: ttlSeconds });
      return true;
    } catch (error) {
      this.logger.error('Error setting cached value', { key, error });
      return false;
    }
  }
  
  /**
   * Delete a cached value
   */
  async del(key: string): Promise<boolean> {
    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      this.logger.error('Error deleting cached value', { key, error });
      return false;
    }
  }
  
  /**
   * Invalidate all keys matching a pattern
   */
  async invalidatePattern(pattern: string): Promise<boolean> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(keys);
        this.logger.debug(`Invalidated ${keys.length} keys matching pattern: ${pattern}`);
      }
      return true;
    } catch (error) {
      this.logger.error('Error invalidating cache pattern', { pattern, error });
      return false;
    }
  }
  
  /**
   * Set cache with hash fields
   */
  async hset(key: string, fields: Record<string, string>, ttlSeconds: number = this.defaultTtl): Promise<boolean> {
    try {
      await this.redis.hSet(key, fields);
      await this.redis.expire(key, ttlSeconds);
      return true;
    } catch (error) {
      this.logger.error('Error setting hash cache', { key, error });
      return false;
    }
  }
  
  /**
   * Get field from hash cache
   */
  async hget(key: string, field: string): Promise<string | null> {
    try {
      const result = await this.redis.hGet(key, field);
      return result === null ? null : result as string;
    } catch (error) {
      this.logger.error('Error getting hash field', { key, field, error });
      return null;
    }
  }
  
  /**
   * Get all fields from hash cache
   */
  async hgetall(key: string): Promise<Record<string, string> | null> {
    try {
      const result = await this.redis.hGetAll(key);
      return Object.keys(result).length > 0 ? result : null;
    } catch (error) {
      this.logger.error('Error getting all hash fields', { key, error });
      return null;
    }
  }
}
