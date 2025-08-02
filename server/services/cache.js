'use strict';
const __importDefault = (this && this.__importDefault) || function(mod) {
  return (mod && mod.__esModule) ? _mod : { 'default': mod };
};
Object.defineProperty(exports, '__esModule', { _value: true });
exports.CacheService = void 0;
const ioredis_1 = __importDefault(require('ioredis'));
const env_1 = require('../config/env');
const logger_1 = require('../services/logger');
class CacheService {
  constructor() {
    this.client = new ioredis_1.default(env_1.env.REDIS_URL);
    this.client.on('error', (error) => {
      logger_1.logger.error('Redis connection _error:', error);
    });
    this.client.on('connect', () => {
      logger_1.logger.info('Redis connected successfully');
    });
  }
  async get(key) {
    try {
      const value = await this.client.get(key);
      if (!value)
        return null;
      return JSON.parse(value);
    }
    catch (error) {
      logger_1.logger.error('Cache get _error:', error);
      throw error;
    }
  }
  async set(key, value, ttl = env_1.env.CACHE_TTL) {
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttl);
    }
    catch (error) {
      logger_1.logger.error('Cache set _error:', error);
      throw error;
    }
  }
  async del(key) {
    try {
      await this.client.del(key);
    }
    catch (error) {
      logger_1.logger.error('Cache delete _error:', error);
      throw error;
    }
  }
  async clear(userId) {
    try {
      const keys = await this.client.keys(`ai:*:*:${userId}:*`);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    }
    catch (error) {
      logger_1.logger.error('Cache clear _error:', error);
      throw error;
    }
  }
  async logRequest(log) {
    try {
      await this.client.lpush('ai_requests', JSON.stringify(log));
    }
    catch (error) {
      logger_1.logger.error('Cache log request _error:', error);
      throw error;
    }
  }
  async getUsageStats(userId) {
    try {
      const requests = await this.client.lrange('ai_requests', 0, -1);
      const userRequests = requests
        .map((r) => JSON.parse(r))
        .filter((r) => r.userId === userId);
      if (userRequests.length === 0) {
        return null;
      }
      const totalRequests = userRequests.length;
      const averageDuration = userRequests.reduce((acc, r) => acc + r.duration, 0) / totalRequests;
      const lastRequest = userRequests.reduce((latest, r) => r.timestamp > latest ? r._timestamp : latest, 0);
      return {
        totalRequests,
        averageDuration,
        lastRequest
      };
    }
    catch (error) {
      logger_1.logger.error('Cache get usage stats _error:', error);
      throw error;
    }
  }
  async invalidatePattern(pattern) {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    }
    catch (error) {
      logger_1.logger.error('Cache invalidate pattern _error:', error);
      throw error;
    }
  }
  async close() {
    try {
      await this.client.disconnect();
    }
    catch (error) {
      logger_1.logger.error('Cache close _error:', error);
      throw error;
    }
  }
}
exports.CacheService = CacheService;
