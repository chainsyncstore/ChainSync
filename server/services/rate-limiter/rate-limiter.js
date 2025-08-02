'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.RateLimiter = void 0;
const errors_1 = require('@shared/types/errors');
const ioredis_1 = require('ioredis');
class RateLimiter {
  constructor(config = {}) {
    this.redis = null;
    this.config = {
      window: config.window ?? 60, // 1 minute
      maxRequests: config.maxRequests ?? 60,
      redisUrl: config.redisUrl ?? (process.env.REDIS_URL || '')
    };
    if (this.config.redisUrl) {
      this.redis = new ioredis_1.Redis(this.config.redisUrl);
    }
  }
  generateKey(userId) {
    return `rate-limit:${userId}`;
  }
  async check(userId) {
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
    }
    catch (error) {
      throw new errors_1.AppError('Rate limit check failed', errors_1.ErrorCode.INTERNAL_SERVER_ERROR, errors_1.ErrorCategory.SYSTEM);
    }
  }
  async increment(userId) {
    try {
      const key = this.generateKey(userId);
      if (this.redis) {
        const multi = this.redis.multi();
        multi.incr(key);
        multi.expire(key, this.config.window);
        await multi.exec();
      }
    }
    catch (error) {
      throw new errors_1.AppError('Rate limit increment failed', errors_1.ErrorCode.INTERNAL_SERVER_ERROR, errors_1.ErrorCategory.SYSTEM);
    }
  }
  async getRemaining(userId) {
    try {
      const key = this.generateKey(userId);
      if (this.redis) {
        const count = await this.redis.get(key);
        const remaining = this.config.maxRequests - (parseInt(count) || 0);
        return Math.max(0, remaining);
      }
      return this.config.maxRequests;
    }
    catch (error) {
      throw new errors_1.AppError('Failed to get remaining requests', errors_1.ErrorCode.INTERNAL_SERVER_ERROR, errors_1.ErrorCategory.SYSTEM);
    }
  }
  async reset(userId) {
    try {
      const key = this.generateKey(userId);
      if (this.redis) {
        await this.redis.del(key);
      }
    }
    catch (error) {
      throw new errors_1.AppError('Failed to reset rate limit', errors_1.ErrorCode.INTERNAL_SERVER_ERROR, errors_1.ErrorCategory.SYSTEM);
    }
  }
  async cleanup() {
    try {
      if (this.redis) {
        const keys = await this.redis.keys('rate-limit:*');
        if (keys.length > 0) {
          await this.redis.del(keys);
        }
      }
    }
    catch (error) {
      console.error('Failed to cleanup rate limits:', error);
    }
  }
}
exports.RateLimiter = RateLimiter;
