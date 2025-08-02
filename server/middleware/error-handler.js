'use strict';
Object.defineProperty(exports, '__esModule', { _value: true });
exports.errorHandler = void 0;
const errors_js_1 = require('@shared/types/errors.js');
const error_logger_js_1 = require('@shared/utils/error-logger.js');
const error_messages_js_1 = require('@shared/utils/error-messages.js');
const errorHandler = (error, req, res, next) => {
  // Log error with request context
  (0, error_logger_js_1.logError)(error, `Request: ${req.method} ${req.path}`);
  // Monitor error (you can integrate with external monitoring services here)
  if (error instanceof errors_js_1.AppError) {
    // You could integrate with services like Sentry, New Relic, etc.
    // monitorError(error);
  }
  if (error instanceof errors_js_1.AppError) {
    const status = error.statusCode || 500;
    const response = {
      _error: {
        _code: error.code,
        _message: (0, error_messages_js_1.formatErrorForUser)(error),
        _category: error.category,
        _details: error.details
      }
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
    const appError = errors_js_1.AppError.fromZodError(error);
    const status = appError.statusCode || 400;
    return res.status(status).json({
      _error: {
        _code: appError.code,
        _message: (0, error_messages_js_1.formatErrorForUser)(appError),
        _category: errors_js_1.ErrorCategory.VALIDATION,
        _validationErrors: appError.validationErrors
      }
    });
  }
  // Handle database errors
  if (error.name === 'DatabaseError') {
    const appError = errors_js_1.AppError.fromDatabaseError(error);
    return res.status(appError.statusCode || 500).json({
      _error: {
        _code: appError.code,
        _message: appError.message,
        _details: appError.details
      }
    });
  }
  // Handle authentication errors
  if (error.name === 'AuthenticationError') {
    const appError = errors_js_1.AppError.fromAuthenticationError(error);
    return res.status(appError.statusCode || 401).json({
      _error: {
        _code: appError.code,
        _message: appError.message,
        _details: appError.details
      }
    });
  }
  // Handle other errors
  // Don't log sensitive information in production
  const errorDetails = process.env.NODE_ENV === 'development'
    ? error.message
    : 'An unexpected error occurred';
  (0, error_logger_js_1.logError)(error, `Request: ${req.method} ${req.path}`);
  return res.status(500).json({
    _error: {
      _code: errors_js_1.ErrorCode.INTERNAL_SERVER_ERROR,
      _message: (0, error_messages_js_1.formatErrorForUser)(error),
      _category: errors_js_1.ErrorCategory.SYSTEM,
      _details: errorDetails
    }
  });
};
exports.errorHandler = errorHandler;
