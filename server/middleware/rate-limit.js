"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRateLimiter = exports.sensitiveOpRateLimiter = exports.authRateLimiter = exports.rateLimitMiddleware = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const index_js_1 = require("../../src/logging/index.js");
const ioredis_1 = __importDefault(require("ioredis"));
// Get centralized logger for rate limiting middleware
const logger = (0, index_js_1.getLogger)().child({ component: 'rate-limit' });
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
            maxRetriesPerRequest: 3,
            connectTimeout: 5000
        });
        // Configure error handler
        redisClient.on('error', (err) => {
            logger.error('Redis rate-limit store error', err);
        });
        // Create store adapter
        return {
            incr: (key, cb) => {
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
            decrement: (key) => {
                redisClient.decr(key, (err) => {
                    if (err) {
                        logger.error('Error decrementing rate limit key', err, { key });
                    }
                });
            },
            resetKey: (key) => {
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
        parseInt(process.env.RATE_LIMIT_WINDOW, 10) * 1000 :
        15 * 60 * 1000; // Default: 15 minutes
    const maxRequests = process.env.RATE_LIMIT_MAX ?
        parseInt(process.env.RATE_LIMIT_MAX, 10) :
        100; // Default: 100 requests per window
    const limiter = (0, express_rate_limit_1.default)({
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
        keyGenerator: (req) => {
            // Default to IP, but can be customized per route to use userId etc.
            return (req.ip || '127.0.0.1');
        },
        // Add structured logging
        handler: (req, res, next, options) => {
            const reqLogger = req.logger || logger;
            reqLogger.warn('Rate limit exceeded', {
                path: req.path,
                method: req.method,
                ip: req.ip,
                userId: req.user?.id
            });
            res.status(options.statusCode).json(options.message);
        },
        // Skip rate limiting for non-production environments if specified
        skip: (req) => {
            return process.env.DISABLE_RATE_LIMIT === 'true' &&
                process.env.NODE_ENV !== 'production';
        },
        // Use Redis store in production if available
        store: redisStore,
        // Add custom options
        ...options
    });
    return limiter;
}
/**
 * Default rate limiter - moderately strict
 */
exports.rateLimitMiddleware = createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
/**
 * Strict rate limiter for authentication endpoints
 * Helps prevent brute force attacks
 */
exports.authRateLimiter = createRateLimiter({
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
exports.sensitiveOpRateLimiter = createRateLimiter({
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
exports.userRateLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 300, // limit each user to 300 requests per hour
    // Use user ID instead of IP for authenticated users
    keyGenerator: (req) => {
        return req.session.userId ?
            `user_${req.session.userId}` :
            (req.ip || '127.0.0.1');
    },
    skip: (req) => {
        // Skip if user is admin or manager
        return req.session.userRole === 'admin' || req.session.userRole === 'manager';
    }
});
