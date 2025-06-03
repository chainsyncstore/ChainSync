import { Request, Response, NextFunction } from 'express';
import { createClient, RedisClientType } from 'redis'; 
import { getLogger } from '../../src/logging'; 
import { UserPayload } from '../types/user'; // Corrected: Import UserPayload from ../types/user

const logger = getLogger().child({ component: 'enhanced-rate-limit' });

/**
 * Enhanced Rate Limiting Middleware
 * Provides flexible rate limiting with Redis backend and per-endpoint configuration
 */

interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  message?: string;
  statusCode?: number;
  headers?: boolean;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
  onLimitReached?: (req: Request, res: Response) => void;
  store?: RateLimitStore;
}

interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<{ count: number; resetTime: number }>;
  reset(key: string): Promise<void>;
}

/**
 * Redis-based rate limit store
 */
class RedisRateLimitStore implements RateLimitStore {
  private client: RedisClientType | null = null; 
  private connected: boolean = false;

  constructor() {
    if (process.env.REDIS_URL || process.env.REDIS_HOST) {
      const redisClient = createClient({
        url: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`
      });
      this.client = redisClient as RedisClientType;
      
      redisClient.on('error', (err: Error) => {
        logger.error('Redis rate limit store error:', err);
        this.connected = false;
      });
      
      redisClient.on('connect', () => {
        logger.info('Redis rate limit store connected.');
        this.connected = true;
      });
      
      redisClient.connect().catch((err: Error) => {
        logger.error('Failed to connect to Redis for rate limiting:', err);
      });
    } else {
      logger.warn('Redis not configured for rate limiting. Falling back to in-memory store.');
    }
  }

  async increment(key: string, windowMs: number): Promise<{ count: number; resetTime: number }> {
    if (!this.connected || !this.client) {
      // Fallback to memory store if Redis is not available
      return this.memoryFallback(key, windowMs);
    }

    try {
      const redisClient = this.client; // Already checked for null above
      const multi = redisClient.multi();
      multi.incr(key);
      multi.expire(key, Math.ceil(windowMs / 1000));
      
      const results = await multi.exec(); // Returns Promise<Array<string | number | Buffer | null | Error | (string | number | Buffer)[]>>
      
      if (!Array.isArray(results) || results.length < 2) {
        logger.error('Redis multi.exec did not return at least two results', { results });
        throw new Error('Invalid results array structure from Redis multi.exec()');
      }
      
      const incrResult = results[0];
      const expireResult = results[1]; // For potential future use or logging

      if (incrResult instanceof Error) {
        logger.error('Redis INCR command in transaction failed', incrResult);
        throw incrResult;
      }
      if (expireResult instanceof Error) {
        logger.error('Redis EXPIRE command in transaction failed', expireResult);
        // Decide if this is critical enough to throw; often INCR is the main one.
      }

      const count = typeof incrResult === 'number' ? incrResult : 0;
      const resetTime = Date.now() + windowMs; 
      
      return { count, resetTime };
    } catch (error: unknown) {
      logger.error('Redis rate limit increment error:', error instanceof Error ? error : new Error(String(error)));
      return this.memoryFallback(key, windowMs);
    }
  }

  async reset(key: string): Promise<void> {
    if (this.connected && this.client) {
      try {
        await this.client.del(key);
      } catch (error: unknown) {
        logger.error('Redis rate limit reset error:', error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  private memoryStore = new Map<string, { count: number; resetTime: number }>();

  private memoryFallback(key: string, windowMs: number): { count: number; resetTime: number } {
    const now = Date.now();
    const existing = this.memoryStore.get(key);
    
    if (!existing || existing.resetTime <= now) {
      const resetTime = now + windowMs;
      this.memoryStore.set(key, { count: 1, resetTime });
      return { count: 1, resetTime };
    }
    
    existing.count++;
    this.memoryStore.set(key, existing);
    return existing;
  }
}

/**
 * Default rate limit configurations for different endpoint types
 */
export const rateLimitConfigs = {
  // Authentication endpoints (stricter limits)
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: 'Too many authentication attempts, please try again later'
  },
  
  // Password reset (very strict)
  passwordReset: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 attempts per hour
    message: 'Too many password reset attempts, please try again later'
  },
  
  // API endpoints (moderate limits)
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: 'Too many API requests, please try again later'
  },
  
  // File uploads (stricter due to resource usage)
  upload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 uploads per hour
    message: 'Too many file uploads, please try again later'
  },
  
  // Search endpoints (moderate limits)
  search: {
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 searches per minute
    message: 'Too many search requests, please slow down'
  },
  
  // General endpoints (lenient)
  general: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // 1000 requests per window
    message: 'Too many requests, please try again later'
  }
};

/**
 * Create rate limiting middleware
 */
export function createRateLimit(options: RateLimitOptions = {}) {
  const defaultOptions: Required<RateLimitOptions> = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: 'Too many requests, please try again later',
    statusCode: 429,
    headers: true,
    keyGenerator: (req: Request) => req.ip || 'unknown',
    skip: () => false,
    onLimitReached: () => {},
    store: new RedisRateLimitStore()
  };

  const opts = { ...defaultOptions, ...options };

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Skip if condition is met
      if (opts.skip(req)) {
        return next();
      }

      const key = `rate_limit:${opts.keyGenerator(req)}:${req.route?.path || req.path}`;
      const result = await opts.store.increment(key, opts.windowMs);

      // Set rate limit headers
      if (opts.headers) {
        res.setHeader('X-RateLimit-Limit', opts.max);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, opts.max - result.count));
        res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());
        res.setHeader('X-RateLimit-Window', opts.windowMs);
      }

      // Check if limit exceeded
      if (result.count > opts.max) {
        opts.onLimitReached(req, res);
        
        return res.status(opts.statusCode).json({
          error: 'Rate limit exceeded',
          message: opts.message,
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
        });
      }

      next();
    } catch (error: unknown) {
      console.error('Rate limiting error:', error);
      logger.error('Rate limiting middleware encountered an error', error instanceof Error ? error : new Error(String(error)));
      next(); // Pass control even if rate limiting fails
    }
  };
}

/**
 * Create rate limiter for specific endpoint types
 */
export function createEndpointRateLimit(type: keyof typeof rateLimitConfigs, customOptions: Partial<RateLimitOptions> = {}) {
  const config = rateLimitConfigs[type];
  return createRateLimit({ ...config, ...customOptions });
}

/**
 * Adaptive rate limiting based on user authentication status
 */
export function createAdaptiveRateLimit(authenticatedOptions: RateLimitOptions, anonymousOptions: RateLimitOptions) {
  const authenticatedLimiter = createRateLimit(authenticatedOptions);
  const anonymousLimiter = createRateLimit(anonymousOptions);

  return (req: Request, res: Response, next: NextFunction) => {
    // Check if user is authenticated (adjust based on your auth implementation)
    const isAuthenticated = req.user || (req.session as any)?.user || req.headers.authorization;
    
    if (isAuthenticated) {
      return authenticatedLimiter(req, res, next);
    } else {
      return anonymousLimiter(req, res, next);
    }
  };
}

/**
 * Progressive rate limiting (increases limits for trusted users)
 */
export function createProgressiveRateLimit(baseOptions: RateLimitOptions) {
  // This function needs to be adapted based on how max is dynamically handled by the store or middleware logic.
  // The current createRateLimit doesn't dynamically adjust max per request based on keyGenerator.
  // For simplicity, this example will use a fixed multiplier for demonstration if we were to adjust options.
  // However, the current structure of createRateLimit uses a single `max` from options.
  // A more complex implementation would involve passing a function for `max` or modifying the store.
  
  // For now, this function will return a rate limiter with a key that includes trust level.
  // The actual dynamic limit adjustment is not implemented by this simple structure.
  logger.warn('Progressive rate limiting with dynamic max based on trust level is not fully implemented by default createRateLimit. Key will include trust level.');
  return createRateLimit({
    ...baseOptions,
    keyGenerator: (req: Request) => {
      const baseKey = req.ip || 'unknown';
      const userTrust = getUserTrustLevel(req); // Assuming UserPayload has createdAt
      return `${baseKey}:trust:${userTrust}`;
    },
    // max: dynamicallyCalculatedMax, // This would require opts.max to be a function or store to handle it
  });
}

/**
 * Get user trust level based on various factors
 */
function getUserTrustLevel(req: Request): 'low' | 'medium' | 'high' {
  // This is a simplified example - implement based on your needs
  // Assumes req.user is UserPayload and UserPayload includes createdAt
  const user = req.user as UserPayload; 
  
  if (!user || !user.createdAt) return 'low';
  
  try {
    // Ensure createdAt is a valid date or timestamp
    const createdAtTime = new Date(user.createdAt as string | number | Date).getTime(); // Cast user.createdAt
    if (isNaN(createdAtTime)) {
      logger.warn('Invalid createdAt date for user trust level calculation', { userId: user.id, createdAt: user.createdAt });
      return 'low';
    }

    const accountAge = Date.now() - createdAtTime;
    const daysSinceCreation = accountAge / (1000 * 60 * 60 * 24);
    
    if (daysSinceCreation > 365) return 'high';
    if (daysSinceCreation > 30) return 'medium';
    return 'low'; // Default if account is young but no error
  } catch (e) {
    logger.error('Error calculating user trust level from createdAt', e instanceof Error ? e : new Error(String(e)));
    return 'low'; // Fallback on error
  }
}

/**
 * Rate limiting for specific IP ranges (e.g., internal networks)
 */
export function createIPBasedRateLimit(ipRanges: { [range: string]: RateLimitOptions }) {
  const limiters = Object.entries(ipRanges).map(([range, options]) => ({
    range,
    limiter: createRateLimit(options),
    matcher: createIPMatcher(range)
  }));

  const defaultLimiter = createRateLimit(rateLimitConfigs.general);

  return (req: Request, res: Response, next: NextFunction) => {
    const clientIP = req.ip || '';
    
    for (const { limiter, matcher } of limiters) {
      if (matcher(clientIP)) {
        return limiter(req, res, next);
      }
    }
    
    return defaultLimiter(req, res, next);
  };
}

/**
 * Create IP matcher function
 */
function createIPMatcher(range: string): (ip: string) => boolean {
  if (range === 'localhost') {
    return (ip: string) => ip === '127.0.0.1' || ip === '::1' || ip === 'localhost';
  }
  
  if (range.includes('/')) {
    // CIDR notation support (simplified)
    const [network, prefixLength] = range.split('/');
    return (ip: string) => {
      // Simplified CIDR matching - implement proper CIDR matching for production
      return ip.startsWith(network.split('.').slice(0, parseInt(prefixLength) / 8).join('.'));
    };
  }
  
  return (ip: string) => ip === range;
}

/**
 * Burst protection - allows short bursts but enforces longer-term limits
 */
export function createBurstRateLimit(shortTermOptions: RateLimitOptions, longTermOptions: RateLimitOptions) {
  const shortTermLimiter = createRateLimit(shortTermOptions);
  const longTermLimiter = createRateLimit(longTermOptions);

  return async (req: Request, res: Response, next: NextFunction) => {
    // Apply both limiters
    shortTermLimiter(req, res, (shortTermError) => {
      if (shortTermError) return;
      
      longTermLimiter(req, res, (longTermError) => {
        if (longTermError) return;
        next();
      });
    });
  };
}

export default createRateLimit;
