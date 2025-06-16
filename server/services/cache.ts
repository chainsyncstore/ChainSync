import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from '../services/logger';

export class CacheService {
  private readonly client: Redis.Redis;

  constructor() {
    this.client = new Redis(env.REDIS_URL);
    this.client.on('error', (error) => {
      logger.error('Redis connection error:', error);
    });
    this.client.on('connect', () => {
      logger.info('Redis connected successfully');
    });
  }

  async get(key: string): Promise<unknown> {
    try {
      const value = await this.client.get(key);
      if (!value) return null;
      return JSON.parse(value);
    } catch (error) {
      logger.error('Cache get error:', error);
      throw error;
    }
  }

  async set(key: string, value: unknown, ttl: number = env.CACHE_TTL): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttl);
    } catch (error) {
      logger.error('Cache set error:', error);
      throw error;
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      logger.error('Cache delete error:', error);
      throw error;
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      logger.error('Cache invalidate pattern error:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      await this.client.disconnect();
    } catch (error) {
      logger.error('Cache close error:', error);
      throw error;
    }
  }
}
