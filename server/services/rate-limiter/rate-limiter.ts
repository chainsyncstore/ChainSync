import { AppError, ErrorCode, ErrorCategory } from '@shared/types/errors';
import { performance } from 'perf_hooks';
import { Redis } from 'ioredis';

export interface RateLimitConfig {
  window: number; // in seconds
  maxRequests: number;
  redisUrl: string;
}

export class RateLimiter {
  private redis: Redis;
  private config: RateLimitConfig;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = {
      window: config.window ?? 60, // 1 minute
      maxRequests: config.maxRequests ?? 60,
      redisUrl: config.redisUrl ?? process.env.REDIS_URL || '',
    };

    if (this.config.redisUrl) {
      this.redis = new Redis(this.config.redisUrl);
    }
  }

  private async withRedis<T>(callback: () => Promise<T>): Promise<T> {
    if (!this.redis) {
      throw new AppError(
        'Redis not configured',
        ErrorCode.CONFIGURATION_ERROR,
        ErrorCategory.SYSTEM
      );
    }

    try {
      return await callback();
    } catch (error: unknown) {
      throw new AppError(
        'Redis error',
        ErrorCode.INTERNAL_SERVER_ERROR,
        ErrorCategory.SYSTEM,
        true,
        5000
      );
    }
  }

  private generateKey(userId: string): string {
    return `rate-limit:${userId}`;
  }

  async check(userId: string): Promise<boolean> {
    try {
      const key = this.generateKey(userId);

      if (this.redis) {
        const [count, expiry] = await this.withRedis(() =>
          this.redis.multi()
            .get(key)
            .ttl(key)
            .exec()
        );

        if (expiry[1] === -1) {
          // Key exists but has no expiry
          throw new AppError(
            'Invalid rate limit state',
            ErrorCode.INTERNAL_SERVER_ERROR,
            ErrorCategory.SYSTEM
          );
        }

        if (count[1] >= this.config.maxRequests) {
          return true;
        }
      }

      return false;
    } catch (error: unknown) {
      throw new AppError(
        'Rate limit check failed',
        ErrorCode.INTERNAL_SERVER_ERROR,
        ErrorCategory.SYSTEM,
        true,
        5000
      );
    }
  }

  async increment(userId: string): Promise<void> {
    try {
      const key = this.generateKey(userId);

      if (this.redis) {
        await this.withRedis(() =>
          this.redis.multi()
            .incr(key)
            .expire(key, this.config.window)
            .exec()
        );
      }
    } catch (error: unknown) {
      throw new AppError(
        'Rate limit increment failed',
        ErrorCode.INTERNAL_SERVER_ERROR,
        ErrorCategory.SYSTEM,
        true,
        5000
      );
    }
  }

  async getRemaining(userId: string): Promise<number> {
    try {
      const key = this.generateKey(userId);

      if (this.redis) {
        const [count] = await this.withRedis(() =>
          this.redis.multi()
            .get(key)
            .exec()
        );

        const remaining = this.config.maxRequests - (parseInt(count[1]) || 0);
        return Math.max(0, remaining);
      }

      return this.config.maxRequests;
    } catch (error: unknown) {
      throw new AppError(
        'Failed to get remaining requests',
        ErrorCode.INTERNAL_SERVER_ERROR,
        ErrorCategory.SYSTEM,
        true,
        5000
      );
    }
  }

  async reset(userId: string): Promise<void> {
    try {
      const key = this.generateKey(userId);

      if (this.redis) {
        await this.withRedis(() => this.redis.del(key));
      }
    } catch (error: unknown) {
      throw new AppError(
        'Failed to reset rate limit',
        ErrorCode.INTERNAL_SERVER_ERROR,
        ErrorCategory.SYSTEM,
        true,
        5000
      );
    }
  }

  async cleanup(): Promise<void> {
    try {
      if (this.redis) {
        const keys = await this.withRedis(() => this.redis.keys('rate-limit:*'));
        if (keys.length > 0) {
          await this.withRedis(() => this.redis.del(keys));
        }
      }
    } catch (error: unknown) {
      console.error('Failed to cleanup rate limits:', error);
    }
  }
}
