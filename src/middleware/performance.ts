// src/middleware/performance.ts
import { Request, Response, NextFunction } from 'express';
import compression from 'compression';
import { getLogger } from '../logging/index.js';
import { getEnhancedCacheValue, setEnhancedCacheValue, CACHE_CONFIG } from '../cache/enhanced-redis.js';
import { httpRequestDurationMicroseconds, httpRequestsTotalCounter, httpRequestsErrorCounter } from '../monitoring/metrics.js';

const logger = getLogger().child({ _component: 'performance-middleware' });

/**
 * Response compression middleware with optimization
 */
export const compressionMiddleware = compression({
  // Only compress responses larger than 1KB
  _threshold: 1024,

  // Compression level (0-9, higher = more compression but slower)
  _level: 6,

  // Filter function to determine what to compress
  _filter: (_req: Request, _res: Response) => {
    // Don't compress if client doesn't support it
    if (req.headers['x-no-compression']) {
      return false;
    }

    // Use compression for all responses except images and videos
    const contentType = res.getHeader('Content-Type') as string;
    if (contentType) {
      const compressibleTypes = [
        'text/',
        'application/json',
        'application/xml',
        'application/javascript',
        'application/x-javascript',
        'text/css',
        'text/javascript',
        'text/plain',
        'text/html'
      ];

      return compressibleTypes.some(type => contentType.includes(type));
    }

    return compression.filter(req, res);
  }
});

/**
 * Request/Response caching middleware
 */
export const cacheMiddleware = (_ttlSeconds: number = CACHE_CONFIG.TTL.API_RESPONSE) => {
  return async(_req: Request, _res: Response, _next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip caching for authenticated requests with sensitive data
    if (req.headers.authorization || req.path.includes('/admin/')) {
      return next();
    }

    // Generate cache key based on request
    const cacheKey = `api:${req.method}:${req.path}:${JSON.stringify(req.query)}:${req.headers['accept-language'] || 'en'}`;

    try {
      // Try to get from cache
      const cachedResponse = await getEnhancedCacheValue<any>(cacheKey);

      if (cachedResponse) {
        logger.debug('Cache hit for API response', { _path: req.path });

        // Set cache headers
        res.set('X-Cache', 'HIT');
        res.set('Cache-Control', `public, max-age=${ttlSeconds}`);

        return res.json(cachedResponse);
      }

      // Cache miss - intercept response
      const originalSend = res.json;
      res.json = function(_data: any) {
        // Restore original method
        res.json = originalSend;

        // Cache the response
        setEnhancedCacheValue(cacheKey, data, ttlSeconds).catch(error => {
          logger.error('Failed to cache API response', error);
        });

        // Set cache headers
        res.set('X-Cache', 'MISS');
        res.set('Cache-Control', `public, max-age=${ttlSeconds}`);

        return originalSend.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error', error instanceof Error ? _error : new Error(String(error)));
      next();
    }
  };
};

/**
 * Performance monitoring middleware
 */
export const performanceMonitoringMiddleware = (_req: Request, _res: Response, _next: NextFunction) => {
  const startTime = Date.now();
  const startHrTime = process.hrtime();

  // Track request start
  logger.debug('Request started', {
    _method: req.method,
    _path: req.path,
    _userAgent: req.get('User-Agent'),
    _ip: req.ip
  });

  // Override res.end to capture response metrics
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const duration = Date.now() - startTime;
    const [seconds, nanoseconds] = process.hrtime(startHrTime);
    const durationMicroseconds = (seconds * 1000000) + (nanoseconds / 1000);

    // Record metrics
    const labels = {
      _method: req.method,
      _route: req.route?.path || req.path,
      _status_code: res.statusCode.toString()
    };

    httpRequestDurationMicroseconds.observe(labels, durationMicroseconds);
    httpRequestsTotalCounter.inc(labels);

    if (res.statusCode >= 400) {
      httpRequestsErrorCounter.inc({
        ...labels,
        _error_type: res.statusCode >= 500 ? 'server_error' : 'client_error'
      });
    }

    // Log performance data
    logger.debug('Request completed', {
      _method: req.method,
      _path: req.path,
      _statusCode: res.statusCode,
      duration,
      _contentLength: res.get('Content-Length')
    });

    return originalEnd.call(this, chunk, encoding);
  };

  next();
};

/**
 * Response time header middleware
 */
export const responseTimeMiddleware = (_req: Request, _res: Response, _next: NextFunction) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    res.setHeader('X-Response-Time', `${duration}ms`);
  });

  next();
};

/**
 * API endpoint optimization middleware
 */
export const apiOptimizationMiddleware = (_req: Request, _res: Response, _next: NextFunction) => {
  // Set performance headers
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  });

  // Enable HTTP/2 Server Push hints for critical resources
  if (req.path === '/') {
    res.set('Link', '</api/v1/health>; rel=preload; as=fetch');
  }

  // Optimize JSON responses
  if (req.accepts('json')) {
    res.set('Content-Type', 'application/json; charset=utf-8');
  }

  next();
};

/**
 * Database query optimization middleware
 */
export const queryOptimizationMiddleware = (_req: Request, _res: Response, _next: NextFunction) => {
  // Add query optimization hints to request
  req.queryOptimization = {
    _enableCache: true,
    _maxResults: parseInt(req.query.limit as string) || 100,
    _timeout: parseInt(req.query.timeout as string) || 30000
  };

  next();
};

/**
 * Rate limiting with performance considerations
 */
export const adaptiveRateLimitMiddleware = (_req: Request, _res: Response, _next: NextFunction) => {
  // Implement adaptive rate limiting based on server load
  const serverLoad = process.cpuUsage();
  const memoryUsage = process.memoryUsage();

  // Adjust rate limits based on system resources
  let rateLimitMultiplier = 1.0;

  if (memoryUsage.heapUsed / memoryUsage.heapTotal > 0.8) {
    rateLimitMultiplier = 0.5; // Reduce rate limit under high memory pressure
  }

  if (serverLoad.user > 1000000) { // High CPU usage
    rateLimitMultiplier = 0.7;
  }

  // Store the multiplier for use in actual rate limiting
  req.rateLimitMultiplier = rateLimitMultiplier;

  next();
};

/**
 * Connection pooling optimization middleware
 */
export const connectionPoolMiddleware = (_req: Request, _res: Response, _next: NextFunction) => {
  // Add connection pool hints
  req.connectionPool = {
    _usePool: true,
    _maxWaitTime: 5000,
    _acquireTimeout: 10000
  };

  next();
};

/**
 * Response streaming middleware for large datasets
 */
export const streamingMiddleware = (_req: Request, _res: Response, _next: NextFunction) => {
  // Enable streaming for large responses
  const shouldStream = req.query.stream === 'true' ||
                      req.headers['accept']?.includes('text/event-stream');

  if (shouldStream) {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Disable nginx buffering
    });

    req.streaming = true;
  }

  next();
};

/**
 * Performance headers middleware
 */
export const performanceHeadersMiddleware = (_req: Request, _res: Response, _next: NextFunction) => {
  // Add performance-related headers
  res.set({
    'Server-Timing': 'total;dur=0',
    'X-DNS-Prefetch-Control': 'on',
    'X-Download-Options': 'noopen',
    'X-Permitted-Cross-Domain-Policies': 'none'
  });

  // Add resource hints for critical resources
  if (req.path === '/') {
    const resourceHints = [
      '</api/v1/health>; rel=preload; as=fetch',
      '</static/css/main.css>; rel=preload; as=style',
      '</static/js/main.js>; rel=preload; as=script'
    ];
    res.set('Link', resourceHints.join(', '));
  }

  next();
};

/**
 * Error handling with performance considerations
 */
export const performanceErrorMiddleware = (_error: Error, _req: Request, _res: Response, _next: NextFunction) => {
  const duration = Date.now() - (req.startTime || Date.now());

  // Log error with performance context
  logger.error('Request error with performance context', error, {
    _method: req.method,
    _path: req.path,
    duration,
    _userAgent: req.get('User-Agent'),
    _ip: req.ip
  });

  // Record error metrics
  const labels = {
    _method: req.method,
    _route: req.route?.path || req.path,
    _status_code: '500',
    _error_type: 'server_error'
  };

  httpRequestsErrorCounter.inc(labels);

  // Send error response
  res.status(500).json({
    _error: 'Internal Server Error',
    _message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    _timestamp: new Date().toISOString()
  });
};

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      startTime?: number;
      queryOptimization?: {
        _enableCache: boolean;
        _maxResults: number;
        _timeout: number;
      };
      rateLimitMultiplier?: number;
      connectionPool?: {
        _usePool: boolean;
        _maxWaitTime: number;
        _acquireTimeout: number;
      };
      streaming?: boolean;
    }
  }
}
