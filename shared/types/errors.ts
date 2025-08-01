import { ZodError, ZodIssue } from 'zod';

// Type definitions for database errors
interface ValidationError extends Error {
  _name: 'ValidationError';
  _errors: any[];
}

interface MongoError extends Error {
  name: 'MongoError';
  _code: number;
  keyValue?: any;
}

export enum ErrorCategory {
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  RESOURCE = 'RESOURCE',
  DATABASE = 'DATABASE',
  BUSINESS = 'BUSINESS',
  SYSTEM = 'SYSTEM',
  IMPORT_EXPORT = 'IMPORT_EXPORT',
  PROCESSING = 'PROCESSING',
  INVALID_FORMAT = 'INVALID_FORMAT',
  EXPORT_ERROR = 'EXPORT_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  NOT_FOUND = 'NOT_FOUND'
}

export enum RetryableError {
  // Temporary errors that might succeed if retried
  TEMPORARY_UNAVAILABLE = 'TEMPORARY_UNAVAILABLE',
  RATE_LIMITED = 'RATE_LIMITED',
  TIMEOUT = 'TIMEOUT',
  NETWORK_ERROR = 'NETWORK_ERROR',
  CONNECTION_LOST = 'CONNECTION_LOST',
  LOCKED_RESOURCE = 'LOCKED_RESOURCE'
}

export enum ErrorCode {
  // Success codes
  SUCCESS = 'SUCCESS',
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  DELETED = 'DELETED',

  // Client errors
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  METHOD_NOT_ALLOWED = 'METHOD_NOT_ALLOWED',
  NOT_ACCEPTABLE = 'NOT_ACCEPTABLE',
  REQUEST_TIMEOUT = 'REQUEST_TIMEOUT',
  CONFLICT = 'CONFLICT',
  GONE = 'GONE',
  LENGTH_REQUIRED = 'LENGTH_REQUIRED',
  PRECONDITION_FAILED = 'PRECONDITION_FAILED',
  PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE',
  URI_TOO_LONG = 'URI_TOO_LONG',
  UNSUPPORTED_MEDIA_TYPE = 'UNSUPPORTED_MEDIA_TYPE',
  RANGE_NOT_SATISFIABLE = 'RANGE_NOT_SATISFIABLE',
  EXPECTATION_FAILED = 'EXPECTATION_FAILED',
  IM_A_TEAPOT = 'IM_A_TEAPOT',
  MISDIRECTED_REQUEST = 'MISDIRECTED_REQUEST',
  UNPROCESSABLE_ENTITY = 'UNPROCESSABLE_ENTITY',
  LOCKED = 'LOCKED',
  FAILED_DEPENDENCY = 'FAILED_DEPENDENCY',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  REQUEST_HEADER_FIELDS_TOO_LARGE = 'REQUEST_HEADER_FIELDS_TOO_LARGE',
  UNAVAILABLE_FOR_LEGAL_REASONS = 'UNAVAILABLE_FOR_LEGAL_REASONS',

  // Server errors
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
  BAD_GATEWAY = 'BAD_GATEWAY',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  GATEWAY_TIMEOUT = 'GATEWAY_TIMEOUT',
  HTTP_VERSION_NOT_SUPPORTED = 'HTTP_VERSION_NOT_SUPPORTED',
  VARIANT_ALSO_NEGOTIATES = 'VARIANT_ALSO_NEGOTIATES',
  INSUFFICIENT_STORAGE = 'INSUFFICIENT_STORAGE',
  LOOP_DETECTED = 'LOOP_DETECTED',
  NOT_EXTENDED = 'NOT_EXTENDED',
  NETWORK_AUTHENTICATION_REQUIRED = 'NETWORK_AUTHENTICATION_REQUIRED',

  // Custom errors
  INVALID_FIELD_VALUE = 'INVALID_FIELD_VALUE',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  INVALID_TOKEN = 'INVALID_TOKEN',
  EXPIRED_TOKEN = 'EXPIRED_TOKEN',
  INVALID_REFRESH_TOKEN = 'INVALID_REFRESH_TOKEN',
  INVALID_RESET_TOKEN = 'INVALID_RESET_TOKEN',
  INVALID_VERIFICATION_TOKEN = 'INVALID_VERIFICATION_TOKEN',
  EXPIRED_RESET_TOKEN = 'EXPIRED_RESET_TOKEN',
  EXPIRED_VERIFICATION_TOKEN = 'EXPIRED_VERIFICATION_TOKEN',
  INVALID_STATE = 'INVALID_STATE',
  INVALID_OPERATION = 'INVALID_OPERATION',
  INVALID_FORMAT = 'INVALID_FORMAT',
  INVALID_PERMISSION = 'INVALID_PERMISSION',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS',
  RESOURCE_LOCKED = 'RESOURCE_LOCKED',
  INVALID_PASSWORD = 'INVALID_PASSWORD',
  WEAK_PASSWORD = 'WEAK_PASSWORD',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS = 'USER_ALREADY_EXISTS',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
  EMAIL_VERIFICATION_FAILED = 'EMAIL_VERIFICATION_FAILED',
  PASSWORD_RESET_FAILED = 'PASSWORD_RESET_FAILED',
  PASSWORD_CHANGE_FAILED = 'PASSWORD_CHANGE_FAILED',
  EMAIL_CHANGE_FAILED = 'EMAIL_CHANGE_FAILED',
  EMAIL_CHANGE_UNAUTHORIZED = 'EMAIL_CHANGE_UNAUTHORIZED',
  EMAIL_CHANGE_ALREADY_EXISTS = 'EMAIL_CHANGE_ALREADY_EXISTS',
  EMAIL_CHANGE_VERIFICATION_FAILED = 'EMAIL_CHANGE_VERIFICATION_FAILED',
  EMAIL_CHANGE_EXPIRED = 'EMAIL_CHANGE_EXPIRED',
  EMAIL_CHANGE_INVALID = 'EMAIL_CHANGE_INVALID',
  EMAIL_CHANGE_NOT_REQUESTED = 'EMAIL_CHANGE_NOT_REQUESTED',
  EMAIL_CHANGE_TOO_FREQUENT = 'EMAIL_CHANGE_TOO_FREQUENT',
  EMAIL_CHANGE_RATE_LIMIT = 'EMAIL_CHANGE_RATE_LIMIT',
  EMAIL_CHANGE_MAX_ATTEMPTS = 'EMAIL_CHANGE_MAX_ATTEMPTS',
  EMAIL_CHANGE_LOCKED = 'EMAIL_CHANGE_LOCKED',
  EMAIL_CHANGE_PENDING = 'EMAIL_CHANGE_PENDING',
  EMAIL_CHANGE_SUCCESS = 'EMAIL_CHANGE_SUCCESS',
  EMAIL_CHANGE_REQUESTED = 'EMAIL_CHANGE_REQUESTED',
  EMAIL_CHANGE_VERIFIED = 'EMAIL_CHANGE_VERIFIED',
  EMAIL_CHANGE_CANCELLED = 'EMAIL_CHANGE_CANCELLED',
  IMPORT_FAILED = 'IMPORT_FAILED',
  EXPORT_FAILED = 'EXPORT_FAILED',
  INVALID_IMPORT_FILE = 'INVALID_IMPORT_FILE',
  INVALID_EXPORT_FILE = 'INVALID_EXPORT_FILE',
  IMPORT_ALREADY_IN_PROGRESS = 'IMPORT_ALREADY_IN_PROGRESS',
  EXPORT_ALREADY_IN_PROGRESS = 'EXPORT_ALREADY_IN_PROGRESS',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  FOREIGN_KEY_CONSTRAINT_VIOLATION = 'FOREIGN_KEY_CONSTRAINT_VIOLATION',

  // Additional error codes referenced in the codebase
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  REQUIRED_FIELD_MISSING = 'REQUIRED_FIELD_MISSING',
  INVALID_FILE = 'INVALID_FILE',
  PROCESSING_ERROR = 'PROCESSING_ERROR',
  EXPORT_ERROR = 'EXPORT_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INVALID_REQUEST = 'INVALID_REQUEST',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  TEMPORARY_UNAVAILABLE = 'TEMPORARY_UNAVAILABLE',
  INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE'
}

export interface BaseError {
  _code: ErrorCode;
  _message: string;
  _category: ErrorCategory;
  details?: Record<string, unknown>;
  statusCode?: number;
}

export class AppError extends Error {
  _code: ErrorCode;
  _category: ErrorCategory;
  details?: Record<string, unknown>;
  statusCode?: number;
  retryable?: boolean;
  retryAfter?: number;
  validationErrors?: any[];

  constructor(
    _message: string,
    _category: ErrorCategory | string,
    _code: ErrorCode | string,
    details?: Record<string, unknown>,
    statusCode?: number,
    retryable?: boolean,
    retryAfter?: number,
    validationErrors?: any[]
  ) {
    super(message);
    this.code = code as ErrorCode;
    this.category = category as ErrorCategory;
    if (details !== undefined) this.details = details;
    if (statusCode !== undefined) this.statusCode = statusCode;
    if (retryable !== undefined) this.retryable = retryable;
    if (retryAfter !== undefined) this.retryAfter = retryAfter;
    if (validationErrors !== undefined) this.validationErrors = validationErrors;
  }

  static fromZodError(_error: ZodError): AppError {
    const issues = error.issues || [];
    return new AppError(
      'Validation failed',
      ErrorCategory.VALIDATION,
      ErrorCode.VALIDATION_ERROR,
      {
        _validationErrors: issues.map((_issue: ZodIssue) => ({
          _path: issue.path,
          _message: issue.message,
          _type: issue.code
        }))
      }
    );
  }

  static isValidationError(_error: Error): error is ValidationError {
    return error.name === 'ValidationError' && 'errors' in error;
  }

  static isMongoError(_error: Error): error is MongoError {
    return error.name === 'MongoError' && 'code' in error;
  }

  static fromDatabaseError(_error: Error): AppError {
    if (AppError.isValidationError(error)) {
      return new AppError(
        'Database validation failed',
        ErrorCategory.VALIDATION,
        ErrorCode.INVALID_FIELD_VALUE,
        {
          _errors: error.errors
        }
      );
    }

    if (AppError.isMongoError(error)) {
      if (error.code === 11000) {
        return new AppError(
          'Duplicate entry',
          ErrorCategory.DATABASE,
          ErrorCode.DUPLICATE_ENTRY,
          {
            _keyValue: error.keyValue
          }
        );
      }

      // Handle other MongoDB error codes
      if (error.code === 11001 || error.code === 11002) {
        return new AppError(
          'Duplicate entry',
          ErrorCategory.DATABASE,
          ErrorCode.DUPLICATE_ENTRY,
          {
            _keyValue: error.keyValue
          }
        );
      }

      // Handle foreign key constraint violation
      if (error.code === 11003) {
        return new AppError(
          'Foreign key constraint violation',
          ErrorCategory.DATABASE,
          ErrorCode.FOREIGN_KEY_CONSTRAINT_VIOLATION,
          {
            _keyValue: error.keyValue
          }
        );
      }

      // Handle other database errors
      return new AppError(
        'Database error',
        ErrorCategory.DATABASE,
        ErrorCode.DATABASE_ERROR,
        {
          _message: error.message
        }
      );
    }

    // Handle other database errors
    return new AppError(
      'Database error',
      ErrorCategory.DATABASE,
      ErrorCode.DATABASE_ERROR,
      {
        _message: error.message
      }
    );
  }

  static fromAuthenticationError(_error: Error): AppError {
    return new AppError(
      'Authentication error',
      ErrorCategory.AUTHENTICATION,
      ErrorCode.UNAUTHORIZED,
      {
        _message: error.message
      }
    );
  }

  static fromResourceError(_error: Error): AppError {
    return new AppError(
      'Resource error',
      ErrorCategory.RESOURCE,
      ErrorCode.NOT_FOUND,
      {
        _message: error.message
      }
    );
  }

  static fromBusinessError(_error: Error): AppError {
    return new AppError(
      'Business error',
      ErrorCategory.BUSINESS,
      ErrorCode.BAD_REQUEST,
      {
        _message: error.message
      }
    );
  }

  static fromSystemError(_error: Error): AppError {
    return new AppError(
      'System error',
      ErrorCategory.SYSTEM,
      ErrorCode.INTERNAL_SERVER_ERROR,
      {
        _message: error.message
      }
    );
  }

  static fromImportExportError(_error: Error): AppError {
    return new AppError(
      'Import/export error',
      ErrorCategory.IMPORT_EXPORT,
      ErrorCode.BAD_REQUEST,
      {
        _message: error.message
      }
    );
  }

  static fromProcessingError(_error: Error): AppError {
    return new AppError(
      'Processing error',
      ErrorCategory.PROCESSING,
      ErrorCode.INTERNAL_SERVER_ERROR,
      {
        _message: error.message
      }
    );
  }

  static fromInvalidFormatError(_error: Error): AppError {
    return new AppError(
      'Invalid format error',
      ErrorCategory.INVALID_FORMAT,
      ErrorCode.BAD_REQUEST,
      {
        _message: error.message
      }
    );
  }

  static fromExportError(_error: Error): AppError {
    return new AppError(
      'Export error',
      ErrorCategory.EXPORT_ERROR,
      ErrorCode.INTERNAL_SERVER_ERROR,
      {
        _message: error.message
      }
    );
  }

  static fromRetryableError(_error: Error): AppError {
    return new AppError(
      'Retryable error',
      ErrorCategory.SYSTEM,
      ErrorCode.INTERNAL_SERVER_ERROR,
      {
        _message: error.message
      }
    );
  }

  get status(): number {
    switch (this.code) {
      case ErrorCode._INVALID_FIELD_VALUE:
      case ErrorCode._INVALID_FORMAT:
      case ErrorCode._INVALID_PERMISSION:
        return 400;
      case ErrorCode._UNAUTHORIZED:
      case ErrorCode._EXPIRED_TOKEN:
        return 401;
      case ErrorCode._FORBIDDEN:
        return 403;
      case ErrorCode._NOT_FOUND:
        return 404;
      case ErrorCode._METHOD_NOT_ALLOWED:
        return 405;
      case ErrorCode._NOT_ACCEPTABLE:
        return 406;
      case ErrorCode._REQUEST_TIMEOUT:
        return 408;
      case ErrorCode._CONFLICT:
        return 409;
      case ErrorCode._GONE:
        return 410;
      case ErrorCode._LENGTH_REQUIRED:
        return 411;
      case ErrorCode._PRECONDITION_FAILED:
        return 412;
      case ErrorCode._PAYLOAD_TOO_LARGE:
        return 413;
      case ErrorCode._URI_TOO_LONG:
        return 414;
      case ErrorCode._UNSUPPORTED_MEDIA_TYPE:
        return 415;
      case ErrorCode._RANGE_NOT_SATISFIABLE:
        return 416;
      case ErrorCode._EXPECTATION_FAILED:
        return 417;
      case ErrorCode._IM_A_TEAPOT:
        return 418;
      case ErrorCode._MISDIRECTED_REQUEST:
        return 421;
      case ErrorCode._UNPROCESSABLE_ENTITY:
        return 422;
      case ErrorCode._LOCKED:
        return 423;
      case ErrorCode._FAILED_DEPENDENCY:
        return 424;
      case ErrorCode._TOO_MANY_REQUESTS:
        return 429;
      case ErrorCode._REQUEST_HEADER_FIELDS_TOO_LARGE:
        return 431;
      case ErrorCode._UNAVAILABLE_FOR_LEGAL_REASONS:
        return 451;
      case ErrorCode._FOREIGN_KEY_CONSTRAINT_VIOLATION:
      case ErrorCode._DUPLICATE_ENTRY:
        return 400;
      case ErrorCode._INTERNAL_SERVER_ERROR:
        return 500;
      case ErrorCode._NOT_IMPLEMENTED:
        return 501;
      case ErrorCode._BAD_GATEWAY:
        return 502;
      case ErrorCode._SERVICE_UNAVAILABLE:
        return 503;
      case ErrorCode._GATEWAY_TIMEOUT:
        return 504;
      case ErrorCode._HTTP_VERSION_NOT_SUPPORTED:
        return 505;
      case ErrorCode._VARIANT_ALSO_NEGOTIATES:
        return 506;
      case ErrorCode._INSUFFICIENT_STORAGE:
        return 507;
      case ErrorCode._LOOP_DETECTED:
        return 508;
      case ErrorCode._NOT_EXTENDED:
        return 510;
      case ErrorCode._NETWORK_AUTHENTICATION_REQUIRED:
        return 511;
      return 500;
    }
  }
}
