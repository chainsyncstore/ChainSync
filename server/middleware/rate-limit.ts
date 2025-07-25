import { Request, Response, NextFunction, RequestHandler } from 'express';
import rateLimit, { Options } from 'express-rate-limit';
import { getLogger } from '../../src/logging/index.js';
import Redis from 'ioredis';

// Get centralized logger for rate limiting middleware
const logger = getLogger().child({ component: 'rate-limit' });

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
    const redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      connectTimeout: 5000
    });
    
    // Configure error handler
    redisClient.on('error', (err) => {
      logger.error('Redis rate-limit store error', err);
    });
    
    // Create store adapter
    return {
      incr: (key: string, cb: (err: Error | null, hits: number) => void) => {
        redisClient.incr(key, (err, result) => {
          if (err) {
            logger.error('Error incrementing rate limit key', err, { key });
            return cb(err, 0);
          }
          
          // Set expiration on first increment
          if (result === 1) {
            // Convert windowMs to seconds for Redis TTL
            const ttlSeconds = Math.ceil(process.env.RATE_LIMIT_WINDOW ? 
              parseInt(process.env.RATE_LIMIT_WINDOW, 10) / 1000 : 
              900); // Default: 15 minutes
              
            redisClient.expire(key, ttlSeconds);
          }
          
          if (result !== undefined) {
            cb(null, result);
          }
        });
      },
      decrement: (key: string) => {
        redisClient.decr(key, (err) => {
          if (err) {
            logger.error('Error decrementing rate limit key', err, { key });
          }
        });
      },
      resetKey: (key: string) => {
        redisClient.del(key, (err) => {
          if (err) {
            logger.error('Error resetting rate limit key', err, { key });
          }
        });
      }
    };
  } catch (error) {
    logger.error('Failed to initialize Redis rate-limit store', error as Error);
    return null;
  }
};

/**
 * Create rate limiting middleware with logging
 */
function createRateLimiter(options: Partial<Options>) {
  const useRedis = process.env.REDIS_URL && process.env.NODE_ENV === 'production';
  const redisStore = useRedis ? createRedisStore() : null;
  
  // Get config from environment or use defaults
  const windowMs = process.env.RATE_LIMIT_WINDOW ? 
    parseInt(process.env.RATE_LIMIT_WINDOW, 10) * 1000 : 
    15 * 60 * 1000; // Default: 15 minutes
    
  const maxRequests = process.env.RATE_LIMIT_MAX ? 
    parseInt(process.env.RATE_LIMIT_MAX, 10) : 
    100; // Default: 100 requests per window
  
  const limiter = rateLimit({
    windowMs,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: 429,
      message: 'Too many requests, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED'
    },
    // Custom key generator that can use different attributes
    keyGenerator: (req: Request) => {
      // Default to IP, but can be customized per route to use userId etc.
      return (req.ip || '127.0.0.1');
    },
    // Add structured logging
    handler: (req: Request, res: Response, next: NextFunction, options: any) => {
      const reqLogger = (req as any).logger || logger;
      
      reqLogger.warn('Rate limit exceeded', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        userId: (req as any).user?.id
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
export const rateLimitMiddleware: RequestHandler = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

/**
 * Strict rate limiter for authentication endpoints
 * Helps prevent brute force attacks
 */
export const authRateLimiter: RequestHandler = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 login attempts per windowMs
  message: {
    status: 429,
    message: 'Too many login attempts from this IP, please try again later.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  }
});

/**
 * API rate limiter for sensitive operations
 * (e.g., loyalty points, transactions, refunds)
 */
export const sensitiveOpRateLimiter: RequestHandler = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // limit each IP to 20 sensitive operations per minute
  message: {
    status: 429,
    message: 'Too many operations attempted, please try again in a minute.',
    code: 'SENSITIVE_OP_RATE_LIMIT_EXCEEDED'
  }
});

/**
 * Per-user rate limiter for endpoints that could be abused
 * This uses the user ID from the session instead of IP address
 */
export const userRateLimiter: RequestHandler = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 300, // limit each user to 300 requests per hour
  // Use user ID instead of IP for authenticated users
  keyGenerator: (req: Request) => {
    return (req.session as any).userId ?
      `user_${(req.session as any).userId}` :
      (req.ip || '127.0.0.1');
  },
  skip: (req: Request) => {
    // Skip if user is admin or manager
    return (req.session as any).userRole === 'admin' || (req.session as any).userRole === 'manager';
  }
});
