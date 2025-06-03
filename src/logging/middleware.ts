// src/logging/middleware.ts
import { Request, Response, NextFunction, RequestHandler, ErrorRequestHandler } from 'express';
import { Logger } from './Logger';
import * as crypto from 'crypto';

/**
 * Express middleware for request logging and correlation tracking
 */
export function requestLogger(logger: Logger): RequestHandler {
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
export function errorLogger(logger: Logger): ErrorRequestHandler {
  return (err: any, req: Request, res: Response, next: NextFunction) => { // Changed err: unknown to err: any
    // Get request logger if available, otherwise use passed logger
    const requestLoggerInstance = (req as any).logger || logger;
    
    const meta: Record<string, any> = {};

    if (err instanceof Error) {
      meta.stack = err.stack;
      // Standard error properties might be on err directly
      if ('status' in err) meta.status = (err as any).status;
      if ('statusCode' in err && !meta.status) meta.status = (err as any).statusCode;
      if ('code' in err) meta.code = (err as any).code;
    }
    
    // Ensure status is set, default to 500
    meta.status = meta.status || (typeof err === 'object' && err !== null && 'status' in err ? (err as any).status : undefined) || 
                  (typeof err === 'object' && err !== null && 'statusCode' in err ? (err as any).statusCode : undefined) || 500;

    // Ensure code is set if available
    meta.code = meta.code || (typeof err === 'object' && err !== null && 'code' in err ? (err as any).code : undefined);
    
    // Determine type
    meta.type = (typeof err === 'object' && err !== null && err.constructor) ? err.constructor.name : typeof err;

    // Log with an actual Error object as the second argument if possible
    const errorToLog = err instanceof Error ? err : new Error(String(err));
    
    requestLoggerInstance.error('Request error', errorToLog, meta);
    
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
