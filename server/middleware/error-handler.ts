import { AppError, ErrorCode, ErrorCategory, RetryableError } from '@shared/types/errors.js';
import { logError } from '@shared/utils/error-logger.js';
import { formatErrorForUser } from '@shared/utils/error-messages.js';
import { NextFunction, Request, Response } from 'express';

// Enhanced error context interface
interface ErrorContext {
  requestId?: string;
  userId?: string;
  storeId?: string;
  operation?: string;
  _timestamp: Date;
  userAgent?: string;
  ip?: string;
  method?: string;
  path?: string;
  query?: any;
  body?: any;
}

// Error monitoring interface
interface ErrorMonitor {
  captureError(_error: AppError, _context: ErrorContext): void;
  captureMessage(_message: string, _level: 'info' | 'warn' | 'error', _context: ErrorContext): void;
}

// Default error monitor (can be replaced with Sentry, etc.)
class DefaultErrorMonitor implements ErrorMonitor {
  captureError(_error: AppError, _context: ErrorContext): void {
    // In production, this would send to monitoring service
    console.error('Error _captured:', {
      _error: error.message,
      _code: error.code,
      _category: error.category,
      context
    });
  }

  captureMessage(_message: string, _level: 'info' | 'warn' | 'error', _context: ErrorContext): void {
    console[level]('Message _captured:', { message, level, context });
  }
}

// Global error monitor instance
const _errorMonitor: ErrorMonitor = new DefaultErrorMonitor();

/**
 * Enhanced error handler with comprehensive error management
 */
export const errorHandler = (
  _error: Error,
  _req: Request,
  _res: Response,
  _next: NextFunction
) => {
  // Create error context
  const _context: ErrorContext = {
    _requestId: req.headers['x-request-id'] as string,
    _userId: (req as any).user?.id,
    _storeId: (req as any).storeId,
    _operation: `${req.method} ${req.path}`,
    _timestamp: new Date(),
    _userAgent: req.get('User-Agent'),
    _ip: req.ip || req.connection.remoteAddress,
    _method: req.method,
    _path: req.path,
    _query: req.query,
    _body: req.body
  } as any;

  // Log error with request context
  logError(error, `Request: ${req.method} ${req.path}`);

  // Handle different error types
  if (error instanceof AppError) {
    return handleAppError(error, req, res, context);
  }

  // Handle Zod validation errors
  if (error.name === 'ZodError') {
    return handleZodError(error as any, req, res, context);
  }

  // Handle database errors
  if (error.name === 'DatabaseError' || error.name === 'QueryFailedError') {
    return handleDatabaseError(error, req, res, context);
  }

  // Handle authentication errors
  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    return handleAuthError(error, req, res, context);
  }

  // Handle rate limiting errors
  if (error.message.includes('Too many requests')) {
    return handleRateLimitError(error, req, res, context);
  }

  // Handle file upload errors
  if (error.message.includes('File too large') || error.message.includes('Invalid file type')) {
    return handleFileUploadError(error, req, res, context);
  }

  // Handle network errors
  if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
    return handleNetworkError(error, req, res, context);
  }

  // Handle unknown errors
  return handleUnknownError(error, req, res, context);
};

/**
 * Handle AppError instances
 */
function handleAppError(_error: AppError, _req: Request, _res: Response, _context: ErrorContext) {
  // Monitor error
  errorMonitor.captureError(error, context);

  const status = error.statusCode || 500;
  const _response: any = {
    error: {
      _code: error.code,
      _message: formatErrorForUser(error),
      _category: error.category,
      _details: error.details,
      _requestId: context.requestId
    }
  };

  // Include retryable information if applicable
  if (error.retryable !== undefined) {
    response.error.retryable = error.retryable;
  }
  if (error.retryAfter !== undefined) {
    response.error.retryAfter = error.retryAfter;
  }

  // Include validation errors if present
  if (error.validationErrors) {
    response.error.validationErrors = error.validationErrors;
  }

  // Include helpful information for development
  if (process.env.NODE_ENV === 'development') {
    response.error.stack = error.stack;
    response.error.context = context;
  }

  return res.status(status).json(response);
}

/**
 * Handle Zod validation errors
 */
function handleZodError(_error: any, _req: Request, _res: Response, _context: ErrorContext) {
  const appError = AppError.fromZodError(error);
  const status = appError.statusCode || 400;

  errorMonitor.captureError(appError, context);

  return res.status(status).json({
    _error: {
      _code: appError.code,
      _message: formatErrorForUser(appError),
      _category: ErrorCategory.VALIDATION,
      _validationErrors: appError.validationErrors,
      _requestId: context.requestId
    }
  });
}

/**
 * Handle database errors
 */
function handleDatabaseError(_error: Error, _req: Request, _res: Response, _context: ErrorContext) {
  const appError = AppError.fromDatabaseError(error);
  const status = appError.statusCode || 500;

  errorMonitor.captureError(appError, context);

  return res.status(status).json({
    _error: {
      _code: appError.code,
      _message: formatErrorForUser(appError),
      _category: ErrorCategory.DATABASE,
      _requestId: context.requestId
    }
  });
}

/**
 * Handle authentication errors
 */
function handleAuthError(_error: Error, _req: Request, _res: Response, _context: ErrorContext) {
  const appError = AppError.fromAuthenticationError(error);
  const status = appError.statusCode || 401;

  errorMonitor.captureError(appError, context);

  return res.status(status).json({
    _error: {
      _code: appError.code,
      _message: formatErrorForUser(appError),
      _category: ErrorCategory.AUTHENTICATION,
      _requestId: context.requestId
    }
  });
}

/**
 * Handle rate limiting errors
 */
function handleRateLimitError(_error: Error, _req: Request, _res: Response, _context: ErrorContext) {
  const appError = new AppError(
    'Too many requests. Please try again later.',
    ErrorCategory.SYSTEM,
    ErrorCode.TOO_MANY_REQUESTS,
    { _originalError: error.message },
    429,
    true,
    60 // Retry after 60 seconds
  );

  errorMonitor.captureError(appError, context);

  return res.status(429).json({
    _error: {
      _code: appError.code,
      _message: formatErrorForUser(appError),
      _category: ErrorCategory.SYSTEM,
      _retryable: true,
      _retryAfter: 60,
      _requestId: context.requestId
    }
  });
}

/**
 * Handle file upload errors
 */
function handleFileUploadError(_error: Error, _req: Request, _res: Response, _context: ErrorContext) {
  const appError = new AppError(
    'File upload failed. Please check file size and type.',
    ErrorCategory.INVALID_FORMAT,
    ErrorCode.INVALID_FILE,
    { _originalError: error.message },
    400
  );

  errorMonitor.captureError(appError, context);

  return res.status(400).json({
    _error: {
      _code: appError.code,
      _message: formatErrorForUser(appError),
      _category: ErrorCategory.INVALID_FORMAT,
      _requestId: context.requestId
    }
  });
}

/**
 * Handle network errors
 */
function handleNetworkError(_error: Error, _req: Request, _res: Response, _context: ErrorContext) {
  const appError = new AppError(
    'Service temporarily unavailable. Please try again later.',
    ErrorCategory.SYSTEM,
    ErrorCode.SERVICE_UNAVAILABLE,
    { _originalError: error.message },
    503,
    true,
    30 // Retry after 30 seconds
  );

  errorMonitor.captureError(appError, context);

  return res.status(503).json({
    _error: {
      _code: appError.code,
      _message: formatErrorForUser(appError),
      _category: ErrorCategory.SYSTEM,
      _retryable: true,
      _retryAfter: 30,
      _requestId: context.requestId
    }
  });
}

/**
 * Handle unknown errors
 */
function handleUnknownError(_error: Error, _req: Request, _res: Response, _context: ErrorContext) {
  const appError = new AppError(
    'An unexpected error occurred. Please try again later.',
    ErrorCategory.SYSTEM,
    ErrorCode.INTERNAL_SERVER_ERROR,
    { _originalError: error.message },
    500
  );

  errorMonitor.captureError(appError, context);

  return res.status(500).json({
    _error: {
      _code: appError.code,
      _message: formatErrorForUser(appError),
      _category: ErrorCategory.SYSTEM,
      _requestId: context.requestId
    }
  });
}

/**
 * Async error wrapper for route handlers
 */
export const asyncErrorHandler = (_fn: Function) => {
  return (_req: Request, _res: Response, _next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Error boundary for unhandled promise rejections
 */
export const setupUnhandledErrorHandling = () => {
  process.on('unhandledRejection', (reason, promise) => {
    const error = reason instanceof Error ? _reason : new Error(String(reason));
    const _context: ErrorContext = {
      _timestamp: new Date(),
      _operation: 'unhandledRejection'
    };

    logError(error, 'Unhandled Promise Rejection');
    errorMonitor.captureError(
      new AppError(
        'Unhandled promise rejection',
        ErrorCategory.SYSTEM,
        ErrorCode.INTERNAL_SERVER_ERROR,
        { _originalError: error.message },
        500
      ),
      context
    );
  });

  process.on('uncaughtException', (error) => {
    const _context: ErrorContext = {
      _timestamp: new Date(),
      _operation: 'uncaughtException'
    };

    logError(error, 'Uncaught Exception');
    errorMonitor.captureError(
      new AppError(
        'Uncaught exception',
        ErrorCategory.SYSTEM,
        ErrorCode.INTERNAL_SERVER_ERROR,
        { _originalError: error.message },
        500
      ),
      context
    );

    // Gracefully shutdown the process
    process.exit(1);
  });
};

/**
 * Request ID middleware
 */
export const requestIdMiddleware = (_req: Request, _res: Response, _next: NextFunction) => {
  const requestId = req.headers['x-request-id'] || generateRequestId();
  req.headers['x-request-id'] = requestId;
  res.setHeader('x-request-id', requestId);
  next();
};

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Error monitoring setup
 */
export const setupErrorMonitoring = (monitor?: ErrorMonitor) => {
  if (monitor) {
    Object.assign(errorMonitor, monitor);
  }

  // Setup unhandled error handling
  setupUnhandledErrorHandling();

  // Log monitoring setup
  console.log('Error monitoring setup complete');
};
