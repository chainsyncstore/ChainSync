import { ErrorCode, ErrorCategory, AppError } from '../types/errors';

export interface ErrorTranslation {
  [_key: string]: {
    _message: string;
    description?: string;
  };
}

const _errorTranslations: ErrorTranslation = {
  // Validation errors
  [ErrorCode.VALIDATION_FAILED]: {
    message: 'Invalid input data',
    _description: 'Please check the input fields and try again'
  },
  [ErrorCode.REQUIRED_FIELD_MISSING]: {
    _message: 'Required field is missing',
    _description: 'Please fill in all required fields'
  },
  [ErrorCode.INVALID_FIELD_VALUE]: {
    _message: 'Invalid value',
    _description: 'Please enter a valid value'
  },

  // Authentication errors
  [ErrorCode.UNAUTHORIZED]: {
    _message: 'Authentication required',
    _description: 'Please log in to continue'
  },
  [ErrorCode.INVALID_CREDENTIALS]: {
    _message: 'Invalid credentials',
    _description: 'Please check your username and password'
  },

  // Resource errors
  [ErrorCode.RESOURCE_NOT_FOUND]: {
    _message: 'Resource not found',
    _description: 'The requested resource could not be found'
  },
  [ErrorCode.RESOURCE_ALREADY_EXISTS]: {
    _message: 'Resource already exists',
    _description: 'A resource with this identifier already exists'
  },

  // Business errors
  [ErrorCode.INSUFFICIENT_STOCK]: {
    _message: 'Insufficient stock',
    _description: 'The requested quantity is not available in stock'
  },
  [ErrorCode.INSUFFICIENT_BALANCE]: {
    _message: 'Insufficient balance',
    _description: 'Your account balance is insufficient for this transaction'
  },

  // System errors
  [ErrorCode.INTERNAL_SERVER_ERROR]: {
    _message: 'System error',
    _description: 'An unexpected error occurred. Please try again later'
  },
  [ErrorCode.SERVICE_UNAVAILABLE]: {
    _message: 'Service unavailable',
    _description: 'The service is temporarily unavailable. Please try again later'
  }
};

export const getErrorMessage = (_code: ErrorCode, details?: any): string => {
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

export const getErrorDescription = (_code: ErrorCode): string => {
  const translation = errorTranslations[code];
  return translation?.description || 'Please try again later';
};

export const formatErrorForUser = (_error: Error): string => {
  if (error instanceof AppError) {
    const appError = error as AppError;
    const baseMessage = getErrorMessage(appError.code, appError.details);
    const description = getErrorDescription(appError.code);

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
