import { Request, Response, NextFunction } from 'express';

import { AppError, ErrorCategory, ErrorCode } from '../../shared/types/errors.js';
import { getLogger } from '../../src/logging/index.js';

const logger = getLogger().child({ component: 'error-handler' });

/**
 * Central error handling utility for consistent error responses
 */
export function handleError(res: Response, error: unknown): Response {
  if (error instanceof AppError) {
    logger.error('Application error', {
      code: error.code,
      category: error.category,
      message: error.message,
      details: error.details,
      stack: error.stack,
    });
    return res.status(error.statusCode || 500).json({
      error: error.message,
      code: error.code,
      category: error.category,
      details: error.details,
      ...(error.validationErrors && { validationErrors: error.validationErrors }),
      ...(error.retryable && { retryable: error.retryable }),
      ...(error.retryAfter && { retryAfter: error.retryAfter }),
    });
  } else if (error instanceof Error) {
    logger.error('Generic error', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    return res.status(500).json({
      error: error.message || 'An unexpected error occurred',
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      category: ErrorCategory.SYSTEM,
    });
  } else {
    logger.error('Unknown error type', {
      error: String(error),
    });
    return res.status(500).json({
      error: 'An unexpected error occurred of unknown type',
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      category: ErrorCategory.SYSTEM,
    });
  }
}

/**
 * Async error handler middleware for Express routes
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void> | void
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((err: unknown) => {
      handleError(res, err);
    });
  };
}

/**
 * Global error handler middleware for Express
 */
export function globalErrorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (res.headersSent) {
    return next(error);
  }

  handleError(res, error);
}
