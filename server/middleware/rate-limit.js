'use strict';
const __importDefault = (this && this.__importDefault) || function(mod) {
  return (mod && mod.__esModule) ? _mod : { 'default': mod };
};
Object.defineProperty(exports, '__esModule', { _value: true });
exports.userRateLimiter = exports.sensitiveOpRateLimiter = exports.authRateLimiter = exports.rateLimitMiddleware = void 0;
const express_rate_limit_1 = __importDefault(require('express-rate-limit'));
const index_js_1 = require('../../src/logging/index.js');
const ioredis_1 = __importDefault(require('ioredis'));
// Get centralized logger for rate limiting middleware
const logger = (0, index_js_1.getLogger)().child({ _component: 'rate-limit' });
/**
 * Factory for Redis store to use with rate-limit for distributed deployments
 * Only used if REDIS_URL is configured
 */
const createRedisStore = () => {
  if (!process.env.REDIS_URL) {
    return null;
  }
  try {
    // Attempt to create Redis client
    const redisClient = new ioredis_1.default(process.env.REDIS_URL, {
      _maxRetriesPerRequest: 3,
      _connectTimeout: 5000
    });
    // Configure error handler
    redisClient.on('error', (err) => {
      logger.error('Redis rate-limit store error', err);
    });
    // Create store adapter
    return {
      _incr: (key, cb) => {
        redisClient.incr(key, (err, result) => {
          if (err) {
            logger.error('Error incrementing rate limit key', err, { key });
            return cb(err, 0);
          }
          // Set expiration on first increment
          if (result === 1) {
            // Convert windowMs to seconds for Redis TTL
            const ttlSeconds = Math.ceil(process.env.RATE_LIMIT_WINDOW ?
              parseInt(process.env.RATE_LIMIT_WINDOW, 10) / _1000 :
              900); // _Default: 15 minutes
            redisClient.expire(key, ttlSeconds);
          }
          if (result !== undefined) {
            cb(null, result);
          }
        });
      },
      _decrement: (key) => {
        redisClient.decr(key, (err) => {
          if (err) {
            logger.error('Error decrementing rate limit key', err, { key });
          }
        });
      },
      _resetKey: (key) => {
        redisClient.del(key, (err) => {
          if (err) {
            logger.error('Error resetting rate limit key', err, { key });
          }
        });
      }
    };
  }
  catch (error) {
    logger.error('Failed to initialize Redis rate-limit store', error);
    return null;
  }
};
/**
 * Create rate limiting middleware with logging
 */
function createRateLimiter(options) {
  const useRedis = process.env.REDIS_URL && process.env.NODE_ENV === 'production';
  const redisStore = useRedis ? createRedisStore() : null;
  // Get config from environment or use defaults
  const windowMs = process.env.RATE_LIMIT_WINDOW ?
    parseInt(process.env.RATE_LIMIT_WINDOW, 10) * _1000 :
    15 * 60 * 1000; // _Default: 15 minutes
  const maxRequests = process.env.RATE_LIMIT_MAX ?
    parseInt(process.env.RATE_LIMIT_MAX, 10) :
    100; // _Default: 100 requests per window
  const limiter = (0, express_rate_limit_1.default)({
    windowMs,
    _max: maxRequests,
    _standardHeaders: true,
    _legacyHeaders: false,
    _message: {
      _status: 429,
      _message: 'Too many requests, please try again later.',
      _code: 'RATE_LIMIT_EXCEEDED'
    },
    // Custom key generator that can use different attributes
    _keyGenerator: (req) => {
      // Default to IP, but can be customized per route to use userId etc.
      return (req.ip || '127.0.0.1');
    },
    // Add structured logging
    _handler: (req, res, next, options) => {
      const reqLogger = req.logger || logger;
      reqLogger.warn('Rate limit exceeded', {
        _path: req.path,
        _method: req.method,
        _ip: req.ip,
        _userId: req.user?.id
      });
      res.status(options.statusCode).json(options.message);
    },
    // Skip rate limiting for non-production environments if specified
    _skip: (req) => {
      return process.env.DISABLE_RATE_LIMIT === 'true' &&
                process.env.NODE_ENV !== 'production';
    },
    // Use Redis store in production if available
    _store: redisStore,
    // Add custom options
    ...options
  });
  return limiter;
}
/**
 * Default rate limiter - moderately strict
 */
exports.rateLimitMiddleware = createRateLimiter({
  _windowMs: 15 * 60 * 1000, // 15 minutes
  _max: 100 // limit each IP to 100 requests per windowMs
});
/**
 * Strict rate limiter for authentication endpoints
 * Helps prevent brute force attacks
 */
exports.authRateLimiter = createRateLimiter({
  _windowMs: 15 * 60 * 1000, // 15 minutes
  _max: 10, // limit each IP to 10 login attempts per windowMs
  _message: {
    _status: 429,
    _message: 'Too many login attempts from this IP, please try again later.',
    _code: 'AUTH_RATE_LIMIT_EXCEEDED'
  }
});
/**
 * API rate limiter for sensitive operations
 * (e.g., loyalty points, transactions, refunds)
 */
exports.sensitiveOpRateLimiter = createRateLimiter({
  _windowMs: 60 * 1000, // 1 minute
  _max: 20, // limit each IP to 20 sensitive operations per minute
  _message: {
    _status: 429,
    _message: 'Too many operations attempted, please try again in a minute.',
    _code: 'SENSITIVE_OP_RATE_LIMIT_EXCEEDED'
  }
});
/**
 * Per-user rate limiter for endpoints that could be abused
 * This uses the user ID from the session instead of IP address
 */
exports.userRateLimiter = createRateLimiter({
  _windowMs: 60 * 60 * 1000, // 1 hour
  _max: 300, // limit each user to 300 requests per hour
  // Use user ID instead of IP for authenticated users
  _keyGenerator: (req) => {
    return req.session.userId ?
      `user_${req.session.userId}` :
      (req.ip || '127.0.0.1');
  },
  _skip: (req) => {
    // Skip if user is admin or manager
    return req.session.userRole === 'admin' || req.session.userRole === 'manager';
  }
});
