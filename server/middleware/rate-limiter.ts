import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { Request, Response, NextFunction } from 'express';
import { createClient } from 'redis';
import { getLogger } from '../../src/logging';

const logger = getLogger().child({ component: 'rate-limiter' });

// Create a Redis client
let redisClient: unknown;

try {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  redisClient = createClient({ url: redisUrl });
  redisClient.on('error', (err: Error) => {
    logger.error('Redis client error', { error: err.message });
  });

  // Connect to Redis in the background
  (async () => {
    try {
      await redisClient.connect();
      logger.info('Redis client connected for rate limiting');
    } catch (err: unknown) {
      logger.error('Failed to connect Redis client for rate limiting', { error: (err as Error).message });
    }
  })();
} catch (err: unknown) {
  logger.error('Failed to create Redis client for rate limiting', { error: (err as Error).message });
}

/**
 * Rate limit store factory
 * Falls back to memory store if Redis is not available
 */
function createStore() {
  if (redisClient && redisClient.isReady) {
    logger.info('Using Redis store for rate limiting');
    return new RedisStore({
      sendCommand: (...args: unknown[]) => redisClient.sendCommand(args),
      prefix: 'rl:'
    });
  }
  
  logger.warn('Using memory store for rate limiting - not suitable for production clusters');
  return undefined; // Will use memory store
}

/**
 * Options for creating a rate limiter
 */
export interface RateLimiterOptions {
  /** Time window in milliseconds */
  windowMs?: number;
  /** Maximum number of requests per window */
  max?: number;
  /** Custom error message */
  message?: string | ((req: Request, res: Response) => string);
  /** Custom key generator function */
  keyGenerator?: (req: Request) => string;
  /** Skip function to bypass rate limiter */
  skip?: (req: Request, res: Response) => boolean;
  /** Path to limit (if not provided, limits all paths) */
  path?: string;
  /** Request methods to limit (if not provided, limits all methods) */
  methods?: string[];
  /** Custom handler for when rate limit is exceeded */
  handler?: (req: Request, res: Response, next: NextFunction) => void;
  /** Headers to include in the response */
  headers?: boolean;
  /** Whether this rate limit is for a sensitive endpoint that needs stronger protection */
  sensitive?: boolean;
}

/**
 * Standard API rate limiter
 * 100 requests per 15 minutes
 */
export const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
  store: createStore()
});

/**
 * Strict rate limiter for auth endpoints
 * 20 requests per 15 minutes
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later.' },
  store: createStore()
});

/**
 * Very strict rate limiter for sensitive operations
 * 5 requests per 15 minutes
 */
export const sensitiveOperationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many sensitive operations attempted, please try again later.' },
  store: createStore()
});

/**
 * Higher limit for public endpoints
 * 300 requests per 15 minutes
 */
export const publicEndpointLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // limit each IP to 300 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
  store: createStore()
});

/**
 * Extreme limiter for brute force protection
 * 3 requests per minute
 */
export const bruteForceProtectionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // limit each IP to 3 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Access temporarily blocked due to suspicious activity.' },
  store: createStore()
});

/**
 * Create a custom rate limiter with the provided options
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const {
    windowMs = 15 * 60 * 1000,
    max = 100,
    message = { error: 'Too many requests, please try again later.' },
    keyGenerator,
    skip,
    handler,
    headers = true,
    sensitive = false
  } = options;
  
  return rateLimit({
    windowMs,
    max,
    message,
    keyGenerator,
    skip,
    handler,
    standardHeaders: headers,
    legacyHeaders: false,
    store: createStore()
  });
}

/**
 * Applies appropriate rate limiters to routes based on sensitivity
 */
export function applyRateLimiters(app: unknown) {
  // Apply standard limiter globally
  app.use(standardLimiter);
  
  // Apply auth limiter to authentication routes
  app.use('/api/auth/*', authLimiter);
  
  // Apply sensitive operation limiter to admin routes
  app.use('/api/admin/*', sensitiveOperationLimiter);
  
  // Apply public endpoint limiter to public routes
  app.use('/api/public/*', publicEndpointLimiter);
  
  // Apply brute force protection to login and password reset
  app.use(['/api/auth/login', '/api/auth/reset-password'], bruteForceProtectionLimiter);
  
  logger.info('Rate limiters applied to routes');
}

/**
 * Graceful shutdown handler for rate limiter
 */
export async function shutdownRateLimiter() {
  if (redisClient && redisClient.isReady) {
    try {
      await redisClient.quit();
      logger.info('Rate limiter Redis client closed');
    } catch (err: unknown) {
      logger.error('Error closing rate limiter Redis client', { error: (err as Error).message });
    }
  }
}
