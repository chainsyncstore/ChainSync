import { ErrorCode, ErrorCategory, AppError } from '../types/errors.js';

export interface ErrorTranslation {
  [key: string]: {
    message: string;
    description?: string;
  };
}

const errorTranslations: ErrorTranslation = {
  // Validation errors
  [ErrorCode.VALIDATION_FAILED]: {
    message: 'Invalid input data',
    description: 'Please check the input fields and try again',
  },
  [ErrorCode.REQUIRED_FIELD_MISSING]: {
    message: 'Required field is missing',
    description: 'Please fill in all required fields',
  },
  [ErrorCode.INVALID_FIELD_VALUE]: {
    message: 'Invalid value',
    description: 'Please enter a valid value',
  },

  // Authentication errors
  [ErrorCode.UNAUTHORIZED]: {
    message: 'Authentication required',
    description: 'Please log in to continue',
  },
  [ErrorCode.INVALID_CREDENTIALS]: {
    message: 'Invalid credentials',
    description: 'Please check your username and password',
  },

  // Resource errors
  [ErrorCode.RESOURCE_NOT_FOUND]: {
    message: 'Resource not found',
    description: 'The requested resource could not be found',
  },
  [ErrorCode.RESOURCE_ALREADY_EXISTS]: {
    message: 'Resource already exists',
    description: 'A resource with this identifier already exists',
  },

  // Business errors
  [ErrorCode.INSUFFICIENT_STOCK]: {
    message: 'Insufficient stock',
    description: 'The requested quantity is not available in stock',
  },
  [ErrorCode.INSUFFICIENT_BALANCE]: {
    message: 'Insufficient balance',
    description: 'Your account balance is insufficient for this transaction',
  },

  // System errors
  [ErrorCode.INTERNAL_SERVER_ERROR]: {
    message: 'System error',
    description: 'An unexpected error occurred. Please try again later',
  },
  [ErrorCode.SERVICE_UNAVAILABLE]: {
    message: 'Service unavailable',
    description: 'The service is temporarily unavailable. Please try again later',
  },
};

export const getErrorMessage = (code: ErrorCode, details?: unknown): string => {
  const translation = errorTranslations[code];
  if (!translation) {
    return 'An unexpected error occurred';
  }

  // Add specific details to the message if available
  if (
    details &&
    typeof details === 'object' &&
    details !== null &&
    Object.keys(details).length > 0
  ) {
    const detailObj = details as Record<string, any>;
    if ('field' in detailObj && typeof detailObj.field === 'string') {
      return `${translation.message}: ${detailObj.field}`;
    }
    if ('resourceType' in detailObj && typeof detailObj.resourceType === 'string') {
      return `${translation.message}: ${detailObj.resourceType}`;
    }
  }

  return translation.message;
};

export const getErrorDescription = (code: ErrorCode): string => {
  const translation = errorTranslations[code];
  return translation?.description || 'Please try again later';
};

export const formatErrorForUser = (error: Error): string => {
  if (error instanceof AppError) {
    const appError = error;
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
