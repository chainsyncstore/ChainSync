import Redis from 'ioredis';

import { env } from '../config/env';
import { logger } from '../services/logger';

export class CacheService {
  private readonly client: Redis.Redis;

  constructor() {
    this.client = new Redis(env.REDIS_URL);
    this.client.on('error', error => {
      logger.error('Redis connection error:', error);
    });
    this.client.on('connect', () => {
      logger.info('Redis connected successfully');
    });
  }

  async get(key: string): Promise<any> {
    try {
      const value = await this.client.get(key);
      if (!value) return null;
      return JSON.parse(value);
    } catch (error: unknown) {
      logger.error('Cache get error:', error);
      throw error instanceof AppError
        ? error
        : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
    }
  }

  async set(key: string, value: unknown, ttl: number = env.CACHE_TTL): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttl);
    } catch (error: unknown) {
      logger.error('Cache set error:', error);
      throw error instanceof AppError
        ? error
        : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error: unknown) {
      logger.error('Cache delete error:', error);
      throw error instanceof AppError
        ? error
        : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error: unknown) {
      logger.error('Cache invalidate pattern error:', error);
      throw error instanceof AppError
        ? error
        : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
    }
  }

  async close(): Promise<void> {
    try {
      await this.client.disconnect();
    } catch (error: unknown) {
      logger.error('Cache close error:', error);
      throw error instanceof AppError
        ? error
        : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
    }
  }
}
