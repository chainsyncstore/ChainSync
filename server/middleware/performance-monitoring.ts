import { Request, Response, NextFunction } from 'express';
import { getLogger } from '../../src/logging';
import { performance } from 'perf_hooks';
import { createCustomSpan } from '../../monitoring/opentelemetry';

const logger = getLogger().child({ component: 'performance-middleware' });

// Performance thresholds (in milliseconds)
const SLOW_ROUTE_THRESHOLD = 500;
const VERY_SLOW_ROUTE_THRESHOLD = 2000;

/**
 * Middleware to monitor API endpoint performance
 */
export function performanceMonitoring() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = performance.now();
    const requestPath = `${req.method} ${req.path}`;
    
    // Track original end method to measure response time
    const originalEnd = res.end;
    
    // Create a span for OpenTelemetry tracing
    const traceAttributes = {
      'http.method': req.method,
      'http.route': req.path,
      'http.url': req.originalUrl,
      'http.user_agent': req.get('user-agent') || 'unknown',
      'http.client_ip': req.ip || 'unknown',
    };
    
    // Override end method to calculate performance metrics
    res.end = function(this: Response, ...args: any[]): Response {
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      
      // Log slow routes
      if (duration > VERY_SLOW_ROUTE_THRESHOLD) {
        logger.warn('Very slow API request detected', {
          path: requestPath,
          durationMs: duration,
          statusCode: res.statusCode,
          query: req.query,
        });
      } else if (duration > SLOW_ROUTE_THRESHOLD) {
        logger.info('Slow API request detected', {
          path: requestPath,
          durationMs: duration,
          statusCode: res.statusCode,
        });
      }
      
      // Add performance headers to response
      res.setHeader('X-Response-Time', `${duration}ms`);
      
      // Execute original end method with the original arguments
      return originalEnd.apply(this, args as any);
    };
    
    // Pass to next middleware wrapped in a custom trace span
    createCustomSpan(
      `HTTP ${req.method} ${req.path}`,
      () => new Promise((resolve) => {
        next();
        resolve(null);
      }),
      traceAttributes
    ).catch(err => {
      let loggedError: unknown = err;
      if (err instanceof Error) {
        loggedError = { 
          message: err.message, 
          name: err.name, 
          stack: err.stack 
        };
      }
      logger.error('Error in performance monitoring middleware', { error: loggedError });
      next(err);
    });
  };
}

/**
 * Track database query performance with OpenTelemetry
 */
export function trackDatabaseQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>
): Promise<T> {
  return createCustomSpan(
    `DB ${queryName}`,
    queryFn,
    { 'db.operation': queryName }
  );
}

/**
 * Track external API calls with OpenTelemetry
 */
export function trackExternalApiCall<T>(
  apiName: string,
  callFn: () => Promise<T>,
  attributes: Record<string, string | number | boolean> = {}
): Promise<T> {
  return createCustomSpan(
    `API ${apiName}`,
    callFn,
    { 
      'api.name': apiName,
      'span.kind': 'client',
      ...attributes
    }
  );
}

/**
 * Memory usage monitoring middleware
 * Logs memory usage at a configured interval
 */
export function memoryMonitoring(intervalMs = 300000) { // Default: 5 minutes
  let timer: NodeJS.Timeout | null = null;
  
  return (req: Request, res: Response, next: NextFunction) => {
    // Start monitoring if not already started
    if (!timer) {
      timer = setInterval(() => {
        const memoryUsage = process.memoryUsage();
        
        logger.info('Memory usage stats', {
          rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB', // Resident Set Size
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
          external: Math.round(memoryUsage.external / 1024 / 1024) + 'MB',
        });
      }, intervalMs);
      
      // Clean up interval on process exit
      process.on('SIGINT', () => {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      });
    }
    
    next();
  };
}
