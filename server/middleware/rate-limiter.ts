import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { Request, Response, NextFunction, Application } from 'express'; // Added Application
import { createClient, RedisClientType, RedisClientOptions } from 'redis'; // Added RedisClientType and RedisClientOptions
import { getLogger } from '../../src/logging';

const logger = getLogger().child({ component: 'rate-limiter' });

// Create a Redis client
let redisClient: RedisClientType | undefined;

try {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  // Explicitly type options for createClient if needed, though `url` is usually enough
  const clientOptions: RedisClientOptions = { url: redisUrl };
  redisClient = createClient(clientOptions) as RedisClientType; // Cast to ensure type
  redisClient.on('error', (err: Error) => {
    logger.error('Redis client error', { err }); // Consistent error logging
  });

  // Connect to Redis in the background
  (async () => {
    try {
      await redisClient?.connect(); // Use optional chaining as connect might be called before client is fully assigned in some edge cases
      logger.info('Redis client connected for rate limiting');
    } catch (err: unknown) {
      logger.error('Failed to connect Redis client for rate limiting', { err }); // Consistent error logging
    }
  })();
} catch (err: unknown) {
  logger.error('Failed to create Redis client for rate limiting', { err }); // Consistent error logging
}

/**
 * Rate limit store factory
 * Falls back to memory store if Redis is not available
 */
function createStore() {
  if (redisClient && redisClient.isOpen) { // Use isOpen for redis v4
    logger.info('Using Redis store for rate limiting');
    return new RedisStore({
      // rate-limit-redis StoreOptions.sendCommand is:
      // sendCommand(args: ReadonlyArray<string | number | Buffer>): Promise<any>;
      // redis v4 RedisClientType.sendCommand is:
      // sendCommand<T = RedisCommandReply>(args: string[], options?: CommandOptions): Promise<T>;
      // Casting the entire function to 'any' to bypass stubborn type mismatch.
      sendCommand: (async (args: ReadonlyArray<string | number | Buffer>): Promise<any> => {
        const commandArgsForClient = args.map(arg => String(arg)); 

        if (!redisClient || !redisClient.isOpen) {
          logger.error('Redis client not available for sendCommand in rate limiter');
          throw new Error('Redis client not available');
        }
        return redisClient.sendCommand(commandArgsForClient);
      }) as any, // Cast the entire function expression
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
export const rateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
  // store: createStore() // Commented out to default to memory store
});

/**
 * Strict rate limiter for auth endpoints
 * 20 requests per 15 minutes
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later.' },
  // store: createStore() // Commented out to default to memory store
});

/**
 * Very strict rate limiter for sensitive operations
 * 5 requests per 15 minutes
 */
export const sensitiveOpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many sensitive operations attempted, please try again later.' },
  // store: createStore() // Commented out to default to memory store
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
  // store: createStore() // Commented out to default to memory store
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
  // store: createStore() // Commented out to default to memory store
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
    // store: createStore() // Commented out to default to memory store
  });
}

/**
 * Applies appropriate rate limiters to routes based on sensitivity
 */
export function applyRateLimiters(app: Application) { // Typed app
  // Apply standard limiter globally
  app.use(rateLimitMiddleware);
  
  // Apply auth limiter to authentication routes
  app.use('/api/auth/*', authRateLimiter);
  
  // Apply sensitive operation limiter to admin routes
  app.use('/api/admin/*', sensitiveOpRateLimiter);
  
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
  if (redisClient && redisClient.isOpen) { // Use isOpen for redis v4
    try {
      await redisClient.quit(); // No need to cast if redisClient is correctly typed and narrowed
      logger.info('Rate limiter Redis client closed');
    } catch (err: unknown) {
      logger.error('Error closing rate limiter Redis client', { err }); // Consistent error logging
    }
  }
}
