import { Response } from 'express';
import { AppError, ErrorCategory, ErrorCode } from '@shared/types/errors';
import { getLogger } from '../../src/logging';

const logger = getLogger().child({ component: 'error-handler' });

/**
 * Central error handling utility for consistent error responses
 */
export function handleError(res: Response, error: any): Response {
  // Log all errors
  if (error instanceof AppError) {
    logger.error('Application error', { 
      code: error.code, 
      category: error.category, 
      message: error.message,
      details: error.details,
      stack: error.stack
    });

    // Return structured response for AppError
    return res.status(error.statusCode || 500).json({
      error: error.message,
      code: error.code,
      category: error.category,
      details: error.details,
      ...(error.validationErrors && { validationErrors: error.validationErrors }),
      ...(error.retryable && { retryable: error.retryable }),
      ...(error.retryAfter && { retryAfter: error.retryAfter })
    });
  }

  // Handle unknown errors
  logger.error('Unhandled error', { 
    error: error?.message || String(error),
    stack: error?.stack
  });

  // Default error response for non-AppError instances
  return res.status(500).json({
    error: 'An unexpected error occurred',
    code: ErrorCode.INTERNAL_SERVER_ERROR,
    category: ErrorCategory.SYSTEM
  });
}

/**
 * Async error handler middleware for Express routes
 */
export function asyncHandler(fn: Function) {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      handleError(res, error);
    });
  };
}

/**
 * Global error handler middleware for Express
 */
export function globalErrorHandler(error: any, req: any, res: Response, next: any) {
  if (res.headersSent) {
    return next(error);
  }
  
  handleError(res, error);
}
