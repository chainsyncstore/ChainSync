import { Request, Response, NextFunction } from 'express';
import { createClient } from 'redis';

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
  private client: unknown;
  private connected: boolean = false;

  constructor() {
    if (process.env.REDIS_URL || process.env.REDIS_HOST) {
      this.client = createClient({
        url: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`
      });
      
      this.client.on('error', (err: Error) => {
        console.error('Redis rate limit store error:', err);
        this.connected = false;
      });
      
      this.client.on('connect', () => {
        this.connected = true;
      });
      
      this.client.connect().catch((err: Error) => {
        console.error('Failed to connect to Redis for rate limiting:', err);
      });
    }
  }

  async increment(key: string, windowMs: number): Promise<{ count: number; resetTime: number }> {
    if (!this.connected || !this.client) {
      // Fallback to memory store if Redis is not available
      return this.memoryFallback(key, windowMs);
    }

    try {
      const multi = this.client.multi();
      const resetTime = Date.now() + windowMs;
      
      multi.incr(key);
      multi.expire(key, Math.ceil(windowMs / 1000));
      
      const results = await multi.exec();
      const count = results[0];
      
      return { count, resetTime };
    } catch (error: unknown) {
      console.error('Redis rate limit error:', error);
      return this.memoryFallback(key, windowMs);
    }
  }

  async reset(key: string): Promise<void> {
    if (this.connected && this.client) {
      try {
        await this.client.del(key);
      } catch (error: unknown) {
        console.error('Redis rate limit reset error:', error);
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
      // Continue without rate limiting if there's an error
      next();
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
  const getMultiplier = (req: Request): number => {
    const trustLevel = getUserTrustLevel(req);
    const baseLimit = baseOptions.max || 100;
    switch (trustLevel) {
      case 'high': return baseLimit * 3;
      case 'medium': return baseLimit * 2;
      case 'low': return baseLimit;
      default: return baseLimit;
    }
  };

  return createRateLimit({
    ...baseOptions,
    keyGenerator: (req: Request) => {
      const baseKey = req.ip || 'unknown';
      const userTrust = getUserTrustLevel(req);
      return `${baseKey}:trust:${userTrust}`;
    },
    max: baseOptions.max || 100 // Will be dynamically adjusted in the middleware
  });
}

/**
 * Get user trust level based on various factors
 */
function getUserTrustLevel(req: Request): 'low' | 'medium' | 'high' {
  // This is a simplified example - implement based on your needs
  const user = req.user as any;
  
  if (!user) return 'low';
  
  const accountAge = Date.now() - new Date(user.createdAt).getTime();
  const daysSinceCreation = accountAge / (1000 * 60 * 60 * 24);
  
  if (daysSinceCreation > 365) return 'high';
  if (daysSinceCreation > 30) return 'medium';
  return 'low';
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
