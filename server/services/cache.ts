import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from '../services/logger';

export class CacheService {
  private readonly client: Redis;

  constructor() {
    this.client = new Redis(env.REDIS_URL as string);
    this.client.on('error', (error: any) => {
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
    } catch (error) {
      logger.error('Cache get error:', error);
      throw error;
    }
  }

  async set(key: string, value: any, ttl: number = env.CACHE_TTL): Promise<void> {
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

  async clear(userId: string): Promise<void> {
    try {
      const keys = await this.client.keys(`ai:*:*:${userId}:*`);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      logger.error('Cache clear error:', error);
      throw error;
    }
  }

  async logRequest(log: any): Promise<void> {
    try {
      await this.client.lpush('ai_requests', JSON.stringify(log));
    } catch (error) {
      logger.error('Cache log request error:', error);
      throw error;
    }
  }

  async getUsageStats(userId: string): Promise<any> {
    try {
      const requests = await this.client.lrange('ai_requests', 0, -1);
      const userRequests = requests
        .map((r: string) => JSON.parse(r))
        .filter((r: { userId: string }) => r.userId === userId);

      if (userRequests.length === 0) {
        return null;
      }

      const totalRequests = userRequests.length;
      const averageDuration =
        userRequests.reduce(
          (acc: number, r: { duration: number }) => acc + r.duration,
          0
        ) / totalRequests;
      const lastRequest = userRequests.reduce(
        (latest: number, r: { timestamp: number }) =>
          r.timestamp > latest ? r.timestamp : latest,
        0
      );

      return {
        totalRequests,
        averageDuration,
        lastRequest
      };
    } catch (error) {
      logger.error('Cache get usage stats error:', error);
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
