// src/logging/middleware.ts
import { Request, Response, NextFunction } from 'express';
import { Logger } from './Logger';
import * as crypto from 'crypto';

/**
 * Express middleware for request logging and correlation tracking
 */
export function requestLogger(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Generate unique request ID if not present
    const requestId = req.headers['x-request-id'] as string || 
                      crypto.randomBytes(16).toString('hex');
    
    // Add to request/response objects for downstream usage
    req.headers['x-request-id'] = requestId;
    res.setHeader('x-request-id', requestId);
    
    // Create request-scoped logger with correlation ID
    const requestLogger = logger.child({
      requestId,
      method: req.method,
      url: req.originalUrl || req.url,
      ip: req.ip || req.socket.remoteAddress
    });
    
    // Attach logger to request object for use in routes
    (req as any).logger = requestLogger;
    
    // Log request start
    const startTime = Date.now();
    requestLogger.info('Request started');
    
    // Track response
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const level = res.statusCode >= 500 ? 'error' : 
                   res.statusCode >= 400 ? 'warn' : 'info';
      
      const logFn = level === 'error' ? requestLogger.error.bind(requestLogger) : 
                    level === 'warn' ? requestLogger.warn.bind(requestLogger) : 
                    requestLogger.info.bind(requestLogger);
      
      logFn('Request completed', {
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        contentLength: res.get('content-length') || 0,
        contentType: res.get('content-type')
      });
    });
    
    // Continue request handling
    next();
  };
}

/**
 * Express error handler middleware with structured logging
 */
export function errorLogger(logger: Logger) {
  return (err: any, req: Request, res: Response, next: NextFunction) => {
    // Get request logger if available, otherwise use passed logger
    const requestLogger = (req as any).logger || logger;
    
    // Structured error logging
    requestLogger.error('Request error', err, {
      stack: err.stack,
      status: err.status || 500,
      code: err.code,
      type: err.constructor.name
    });
    
    // Continue to next error handler
    next(err);
  };
}

/**
 * Utility to get logger from request
 */
export function getRequestLogger(req: Request): Logger {
  return (req as any).logger;
}
