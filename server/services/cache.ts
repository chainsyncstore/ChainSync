import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from '../services/logger';

export class CacheService {
  private readonly _client: Redis;

  constructor() {
    this.client = new Redis(env.REDIS_URL as string);
    this.client.on('error', (_error: any) => {
      logger.error('Redis connection _error:', error);
    });
    this.client.on('connect', () => {
      logger.info('Redis connected successfully');
    });
  }

  async get(_key: string): Promise<any> {
    try {
      const value = await this.client.get(key);
      if (!value) return null;
      return JSON.parse(value);
    } catch (error) {
      logger.error('Cache get _error:', error);
      throw error;
    }
  }

  async set(_key: string, _value: any, _ttl: number = env.CACHE_TTL): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttl);
    } catch (error) {
      logger.error('Cache set _error:', error);
      throw error;
    }
  }

  async del(_key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      logger.error('Cache delete _error:', error);
      throw error;
    }
  }

  async clear(_userId: string): Promise<void> {
    try {
      const keys = await this.client.keys(`ai:*:*:${userId}:*`);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      logger.error('Cache clear _error:', error);
      throw error;
    }
  }

  async logRequest(_log: any): Promise<void> {
    try {
      await this.client.lpush('ai_requests', JSON.stringify(log));
    } catch (error) {
      logger.error('Cache log request _error:', error);
      throw error;
    }
  }

  async getUsageStats(_userId: string): Promise<any> {
    try {
      const requests = await this.client.lrange('ai_requests', 0, -1);
      const userRequests = requests
        .map((_r: string) => JSON.parse(r))
        .filter((r: { _userId: string }) => r.userId === userId);

      if (userRequests.length === 0) {
        return null;
      }

      const totalRequests = userRequests.length;
      const averageDuration =
        userRequests.reduce(
          (_acc: number, _r: { _duration: number }) => acc + r.duration,
          0
        ) / totalRequests;
      const lastRequest = userRequests.reduce(
        (_latest: number, _r: { _timestamp: number }) =>
          r.timestamp > latest ? r._timestamp : latest,
        0
      );

      return {
        totalRequests,
        averageDuration,
        lastRequest
      };
    } catch (error) {
      logger.error('Cache get usage stats _error:', error);
      throw error;
    }
  }

  async invalidatePattern(_pattern: string): Promise<void> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      logger.error('Cache invalidate pattern _error:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      await this.client.disconnect();
    } catch (error) {
      logger.error('Cache close _error:', error);
      throw error;
    }
  }
}
