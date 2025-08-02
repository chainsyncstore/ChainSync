// server/middleware/rate-limit.ts
// Enhanced rate limiting middleware with per-endpoint configuration
import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { getLogger } from '../../src/logging/index.js';
import { Pool } from 'pg';

const logger = getLogger().child({ component: 'rate-limit-middleware' });

// Rate limit configurations for different endpoint types
const RATE_LIMIT_CONFIG = {
  // General API limits
  general: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: 'Too many requests from this IP, please try again later.'
  },

  // Authentication endpoints (more strict)
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 login attempts per 15 minutes
    message: 'Too many authentication attempts, please try again later.'
  },

  // Sensitive operations (very strict)
  sensitive: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 sensitive operations per hour
    message: 'Too many sensitive operations, please try again later.'
  },

  // Payment endpoints (extremely strict)
  payment: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 payment attempts per hour
    message: 'Too many payment attempts, please try again later.'
  },

  // File upload endpoints
  upload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // 20 uploads per hour
    message: 'Too many file uploads, please try again later.'
  },

  // Admin endpoints
  admin: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // 50 admin operations per 15 minutes
    message: 'Too many admin operations, please try again later.'
  }
};

// Redis store for distributed rate limiting
const createRedisStore = () => {
  try {
    const RedisStore = require('rate-limit-redis').default;
    const redis = require('redis');

    const redisClient = redis.createClient({
      url: process.env.REDIS_URL
    });

    return new RedisStore({
      sendCommand: (...args: any[]) => redisClient.sendCommand(args)
    });
  } catch (error) {
    logger.warn('Redis not available for rate limiting, using memory store', { error });
    return null;
  }
};

/**
 * Create rate limiting middleware with logging
 */
function createRateLimiter(options: Partial<typeof RATE_LIMIT_CONFIG.general>) {
  const useRedis = process.env.REDIS_URL && process.env.NODE_ENV === 'production';
  const redisStore = useRedis ? createRedisStore() : null;

  // Get config from environment or use defaults
  const windowMs = process.env.RATE_LIMIT_WINDOW ?
    parseInt(process.env.RATE_LIMIT_WINDOW, 10) * 1000 :
    options.windowMs || RATE_LIMIT_CONFIG.general.windowMs;

  const maxRequests = process.env.RATE_LIMIT_MAX ?
    parseInt(process.env.RATE_LIMIT_MAX, 10) :
    options.max || RATE_LIMIT_CONFIG.general.max;

  const limiter = rateLimit({
    windowMs,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: 429,
      message: options.message || RATE_LIMIT_CONFIG.general.message,
      code: 'RATE_LIMIT_EXCEEDED'
    },
    // Custom key generator that can use different attributes
    keyGenerator: (req: Request) => {
      // Use user ID if available, otherwise use IP
      const userId = (req as any).user?.id || (req.session as any)?.userId;
      return userId ? `user:${userId}` : (req.ip || '127.0.0.1');
    },
    // Add structured logging
    handler: (req: Request, res: Response, next: NextFunction, options: any) => {
      const reqLogger = (req as any).logger || logger;

      reqLogger.warn('Rate limit exceeded', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        userId: (req as any).user?.id || (req.session as any)?.userId,
        limit: maxRequests,
        windowMs
      });

      res.status(options.statusCode).json(options.message);
    },
    // Skip rate limiting for non-production environments if specified
    skip: (req: Request) => {
      return process.env.DISABLE_RATE_LIMIT === 'true' &&
             process.env.NODE_ENV !== 'production';
    },
    // Use Redis store in production if available
    store: redisStore as any,
    // Add custom options
    ...options
  });

  return limiter;
}

/**
 * Default rate limiter - moderately strict
 */
export const rateLimitMiddleware: RequestHandler = createRateLimiter(RATE_LIMIT_CONFIG.general);

/**
 * Authentication rate limiter - very strict
 */
export const authRateLimiter: RequestHandler = createRateLimiter(RATE_LIMIT_CONFIG.auth);

/**
 * Sensitive operations rate limiter - very strict
 */
export const sensitiveOpRateLimiter: RequestHandler = createRateLimiter(RATE_LIMIT_CONFIG.sensitive);

/**
 * Payment operations rate limiter - extremely strict
 */
export const paymentRateLimiter: RequestHandler = createRateLimiter(RATE_LIMIT_CONFIG.payment);

/**
 * File upload rate limiter
 */
export const uploadRateLimiter: RequestHandler = createRateLimiter(RATE_LIMIT_CONFIG.upload);

/**
 * Admin operations rate limiter
 */
export const adminRateLimiter: RequestHandler = createRateLimiter(RATE_LIMIT_CONFIG.admin);

/**
 * Dynamic rate limiter based on endpoint
 * Allows different limits for different endpoints
 */
export const dynamicRateLimiter = (endpointType: keyof typeof RATE_LIMIT_CONFIG): RequestHandler => {
  return createRateLimiter(RATE_LIMIT_CONFIG[endpointType]);
};

/**
 * User-specific rate limiter
 * Limits based on user ID rather than IP
 */
export const userRateLimiter = (maxRequests: number, windowMs: number = 15 * 60 * 1000): RequestHandler => {
  return rateLimit({
    windowMs,
    max: maxRequests,
    keyGenerator: (req: Request) => {
      const userId = (req as any).user?.id || (req.session as any)?.userId;
      if (!userId) {
        return req.ip || '127.0.0.1'; // Fallback to IP if no user
      }
      return `user:${userId}`;
    },
    message: {
      status: 429,
      message: 'Too many requests for this user, please try again later.',
      code: 'USER_RATE_LIMIT_EXCEEDED'
    },
    handler: (req: Request, res: Response, next: NextFunction, options: any) => {
      const reqLogger = (req as any).logger || logger;

      reqLogger.warn('User rate limit exceeded', {
        path: req.path,
        method: req.method,
        userId: (req as any).user?.id || (req.session as any)?.userId,
        limit: maxRequests,
        windowMs
      });

      res.status(options.statusCode).json(options.message);
    }
  });
};

/**
 * Burst rate limiter for short-term spikes
 * Allows more requests in a shorter window
 */
export const burstRateLimiter = (maxRequests: number, windowMs: number = 60 * 1000): RequestHandler => {
  return createRateLimiter({
    windowMs,
    max: maxRequests,
    message: 'Too many requests in a short time, please slow down.'
  });
};

/**
 * Database-backed rate limiter for persistent limits
 * Stores rate limit data in database for persistence across restarts
 */
export const createDatabaseRateLimiter = (db: Pool, maxRequests: number, windowMs: number = 15 * 60 * 1000) => {
  return async(req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = (req as any).user?.id || req.ip || '127.0.0.1';
      const now = Date.now();
      const windowStart = now - windowMs;

      // Clean up old entries
      await db.query(
        'DELETE FROM rate_limits WHERE created_at < $1',
        [new Date(windowStart)]
      );

      // Get current count
      const countResult = await db.query(
        'SELECT COUNT(*) FROM rate_limits WHERE rate_key = $1 AND created_at > $2',
        [key, new Date(windowStart)]
      );

      const currentCount = parseInt(countResult.rows[0].count);

      if (currentCount >= maxRequests) {
        const reqLogger = (req as any).logger || logger;

        reqLogger.warn('Database rate limit exceeded', {
          path: req.path,
          method: req.method,
          key,
          currentCount,
          limit: maxRequests
        });

        res.status(429).json({
          status: 429,
          message: 'Too many requests, please try again later.',
          code: 'RATE_LIMIT_EXCEEDED'
        });
        return;
      }

      // Record this request
      await db.query(
        'INSERT INTO rate_limits (rate_key, created_at) VALUES ($1, NOW())',
        [key]
      );

      next();
    } catch (error) {
      logger.error('Database rate limiter error', { error });
      // Allow request to proceed if rate limiting fails
      next();
    }
  };
};

/**
 * Adaptive rate limiter that adjusts based on user behavior
 * Reduces limits for suspicious activity
 */
export const adaptiveRateLimiter = (baseMax: number, windowMs: number = 15 * 60 * 1000) => {
  const suspiciousUsers = new Map<string, { count: number; lastReset: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = (req as any).user?.id || req.ip || '127.0.0.1';
    const now = Date.now();

    // Check if user is marked as suspicious
    const suspicious = suspiciousUsers.get(key);
    if (suspicious && now - suspicious.lastReset < windowMs) {
      // Reduce limit for suspicious users
      const reducedMax = Math.max(1, Math.floor(baseMax * 0.1)); // 10% of base limit

      // Apply reduced limit
      const limiter = createRateLimiter({
        windowMs,
        max: reducedMax,
        message: 'Rate limit reduced due to suspicious activity.'
      });

      return limiter(req, res, next);
    }

    // Apply normal limit
    const limiter = createRateLimiter({
      windowMs,
      max: baseMax
    });

    return limiter(req, res, next);
  };
};

// Export configurations for external use
export { RATE_LIMIT_CONFIG };
