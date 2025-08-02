import { AppError, ErrorCode, ErrorCategory } from '@shared/types/errors';
import { performance } from 'perf_hooks';
import { Redis } from 'ioredis';

export interface RateLimitConfig {
  _window: number; // in seconds
  _maxRequests: number;
  _redisUrl: string;
}

export class RateLimiter {
  private _redis: Redis | null = null;
  private _config: RateLimitConfig;

  constructor(_config: Partial<RateLimitConfig> = {}) {
    this.config = {
      _window: config.window ?? 60, // 1 minute
      _maxRequests: config.maxRequests ?? 60,
      _redisUrl: config.redisUrl ?? (process.env.REDIS_URL || '')
    };

    if (this.config.redisUrl) {
      this.redis = new Redis(this.config.redisUrl);
    }
  }

  private generateKey(_userId: string): string {
    return `rate-limit:${userId}`;
  }

  async check(_userId: string): Promise<boolean> {
    try {
      const key = this.generateKey(userId);

      if (this.redis) {
        const result = await this.redis.multi().get(key).ttl(key).exec();
        const count = result && result[0] && Number(result[0][1]);
        const expiry = result && result[1] && Number(result[1][1]);

        if (expiry === -1) {
          // Key exists but has no expiry
          await this.redis.expire(key, this.config.window);
        }

        if (count && count >= this.config.maxRequests) {
          return true;
        }
      }

      return false;
    } catch (error) {
      throw new AppError(
        'Rate limit check failed',
        ErrorCode.INTERNAL_SERVER_ERROR,
        ErrorCategory.SYSTEM
      );
    }
  }

  async increment(_userId: string): Promise<void> {
    try {
      const key = this.generateKey(userId);

      if (this.redis) {
        const multi = this.redis.multi();
        multi.incr(key);
        multi.expire(key, this.config.window);
        await multi.exec();
      }
    } catch (error) {
      throw new AppError(
        'Rate limit increment failed',
        ErrorCode.INTERNAL_SERVER_ERROR,
        ErrorCategory.SYSTEM
      );
    }
  }

  async getRemaining(_userId: string): Promise<number> {
    try {
      const key = this.generateKey(userId);

      if (this.redis) {
        const count = await this.redis.get(key);
        const remaining = this.config.maxRequests - (parseInt(count!) || 0);
        return Math.max(0, remaining);
      }

      return this.config.maxRequests;
    } catch (error) {
      throw new AppError(
        'Failed to get remaining requests',
        ErrorCode.INTERNAL_SERVER_ERROR,
        ErrorCategory.SYSTEM
      );
    }
  }

  async reset(_userId: string): Promise<void> {
    try {
      const key = this.generateKey(userId);

      if (this.redis) {
        await this.redis.del(key);
      }
    } catch (error) {
      throw new AppError(
        'Failed to reset rate limit',
        ErrorCode.INTERNAL_SERVER_ERROR,
        ErrorCategory.SYSTEM
      );
    }
  }

  async cleanup(): Promise<void> {
    try {
      if (this.redis) {
        const keys = await this.redis.keys('rate-limit:*');
        if (keys.length > 0) {
          await this.redis.del(keys);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup rate _limits:', error);
    }
  }
}
