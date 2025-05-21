import { AppError, ErrorCode, ErrorCategory, RetryableError } from '../../shared/types/errors';
import { logError } from '../../shared/utils/error-logger';
import { formatErrorForUser } from '../../shared/utils/error-messages';
import { NextFunction, Request, Response } from 'express';

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log error with request context
  logError(error, `Request: ${req.method} ${req.path}`);

  // Monitor error (you can integrate with external monitoring services here)
  if (error instanceof AppError) {
    // You could integrate with services like Sentry, New Relic, etc.
    // monitorError(error);
  }
  if (error instanceof AppError) {
    const status = error.statusCode || 500;
    const response: any = {
      error: {
        code: error.code,
        message: formatErrorForUser(error),
        category: error.category,
        details: error.details,
      },
    };

    // Only include retryable and retryAfter if they are set
    if (error.retryable !== undefined) {
      response.error.retryable = error.retryable;
    }
    if (error.retryAfter !== undefined) {
      response.error.retryAfter = error.retryAfter;
    }
    if (error.validationErrors) {
      response.error.validationErrors = error.validationErrors;
    }

    return res.status(status).json(response);
  }

  // Handle Zod validation errors
  if (error.name === 'ZodError') {
    const appError = AppError.fromZodError(error as any);
    const status = appError.statusCode || 400;
    return res.status(status).json({
      error: {
        code: appError.code,
        message: formatErrorForUser(appError),
        category: ErrorCategory.VALIDATION,
        validationErrors: appError.validationErrors,
      },
    });
  }

  // Handle database errors
  if (error.name === 'DatabaseError') {
    const appError = AppError.fromDatabaseError(error);
    return res.status(appError.status).json({
      error: {
        code: appError.code,
        message: appError.message,
        details: appError.details,
      },
    });
  }

  // Handle authentication errors
  if (error.name === 'AuthenticationError') {
    const appError = AppError.fromAuthenticationError(error);
    return res.status(appError.status).json({
      error: {
        code: appError.code,
        message: appError.message,
        details: appError.details,
      },
    });
  }

  // Handle other errors
  // Don't log sensitive information in production
  const errorDetails = process.env.NODE_ENV === 'development' 
    ? error.message 
    : 'An unexpected error occurred';
  
  logError(error, `Request: ${req.method} ${req.path}`);
  
  return res.status(500).json({
    error: {
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: formatErrorForUser(error),
      category: ErrorCategory.SYSTEM,
      details: errorDetails,
    },
  });
};
