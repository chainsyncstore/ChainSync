'use strict';
Object.defineProperty(exports, '__esModule', { _value: true });
exports.formatErrorForUser = exports.getErrorDescription = exports.getErrorMessage = void 0;
const errors_1 = require('../types/errors');
const errorTranslations = {
  // Validation errors
  [errors_1.ErrorCode.VALIDATION_FAILED]: {
    _message: 'Invalid input data',
    _description: 'Please check the input fields and try again'
  },
  [errors_1.ErrorCode.REQUIRED_FIELD_MISSING]: {
    _message: 'Required field is missing',
    _description: 'Please fill in all required fields'
  },
  [errors_1.ErrorCode.INVALID_FIELD_VALUE]: {
    _message: 'Invalid value',
    _description: 'Please enter a valid value'
  },
  // Authentication errors
  [errors_1.ErrorCode.UNAUTHORIZED]: {
    _message: 'Authentication required',
    _description: 'Please log in to continue'
  },
  [errors_1.ErrorCode.INVALID_CREDENTIALS]: {
    _message: 'Invalid credentials',
    _description: 'Please check your username and password'
  },
  // Resource errors
  [errors_1.ErrorCode.RESOURCE_NOT_FOUND]: {
    _message: 'Resource not found',
    _description: 'The requested resource could not be found'
  },
  [errors_1.ErrorCode.RESOURCE_ALREADY_EXISTS]: {
    _message: 'Resource already exists',
    _description: 'A resource with this identifier already exists'
  },
  // Business errors
  [errors_1.ErrorCode.INSUFFICIENT_STOCK]: {
    _message: 'Insufficient stock',
    _description: 'The requested quantity is not available in stock'
  },
  [errors_1.ErrorCode.INSUFFICIENT_BALANCE]: {
    _message: 'Insufficient balance',
    _description: 'Your account balance is insufficient for this transaction'
  },
  // System errors
  [errors_1.ErrorCode.INTERNAL_SERVER_ERROR]: {
    _message: 'System error',
    _description: 'An unexpected error occurred. Please try again later'
  },
  [errors_1.ErrorCode.SERVICE_UNAVAILABLE]: {
    _message: 'Service unavailable',
    _description: 'The service is temporarily unavailable. Please try again later'
  }
};
const getErrorMessage = (code, details) => {
  const translation = errorTranslations[code];
  if (!translation) {
    return 'An unexpected error occurred';
  }
  // Add specific details to the message if available
  if (details && Object.keys(details).length > 0) {
    const detailKeys = Object.keys(details);
    if (detailKeys.includes('field')) {
      return `${translation.message}: ${details.field}`;
    }
    if (detailKeys.includes('resourceType')) {
      return `${translation.message}: ${details.resourceType}`;
    }
  }
  return translation.message;
};
exports.getErrorMessage = getErrorMessage;
const getErrorDescription = (code) => {
  const translation = errorTranslations[code];
  return translation?.description || 'Please try again later';
};
exports.getErrorDescription = getErrorDescription;
const formatErrorForUser = (error) => {
  if (error instanceof errors_1.AppError) {
    const appError = error;
    const baseMessage = (0, exports.getErrorMessage)(appError.code, appError.details);
    const description = (0, exports.getErrorDescription)(appError.code);
    // Add retry information if applicable
    if (appError.retryable) {
      if (appError.retryAfter) {
        const retryTime = Math.ceil(appError.retryAfter / 1000);
        return `${baseMessage}. ${description}. Please try again in ${retryTime} seconds.`;
      }
      return `${baseMessage}. ${description}. Please try again later.`;
    }
    return `${baseMessage}. ${description}`;
  }
  // For non-AppError instances
  return 'An unexpected error occurred. Please try again later.';
};
exports.formatErrorForUser = formatErrorForUser;
