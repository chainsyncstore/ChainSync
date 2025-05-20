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
}

export enum RetryableError {
  // Temporary errors that might succeed if retried
  TEMPORARY_UNAVAILABLE = 'TEMPORARY_UNAVAILABLE',
  RATE_LIMITED = 'RATE_LIMITED',
  TIMEOUT = 'TIMEOUT',
  NETWORK_ERROR = 'NETWORK_ERROR',
  CONNECTION_LOST = 'CONNECTION_LOST',
  LOCKED_RESOURCE = 'LOCKED_RESOURCE',
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

  // Import-Export specific errors
  INVALID_FILE = 'INVALID_FILE',
  PROCESSING_ERROR = 'PROCESSING_ERROR',
  INVALID_FORMAT = 'INVALID_FORMAT',
  EXPORT_ERROR = 'EXPORT_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
}

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
}

export const BaseErrorCode = {
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  INVALID_TOKEN: 'INVALID_TOKEN',
  EXPIRED_TOKEN: 'EXPIRED_TOKEN',
  INVALID_REFRESH_TOKEN: 'INVALID_REFRESH_TOKEN',
  INVALID_RESET_TOKEN: 'INVALID_RESET_TOKEN',
  EXPIRED_RESET_TOKEN: 'EXPIRED_RESET_TOKEN',
  INVALID_VERIFICATION_TOKEN: 'INVALID_VERIFICATION_TOKEN',
  EXPIRED_VERIFICATION_TOKEN: 'EXPIRED_VERIFICATION_TOKEN',
  INVALID_PASSWORD: 'INVALID_PASSWORD',
  WEAK_PASSWORD: 'WEAK_PASSWORD',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  EMAIL_VERIFICATION_FAILED: 'EMAIL_VERIFICATION_FAILED',
  PASSWORD_RESET_FAILED: 'PASSWORD_RESET_FAILED',
  PASSWORD_CHANGE_FAILED: 'PASSWORD_CHANGE_FAILED',
  EMAIL_CHANGE_FAILED: 'EMAIL_CHANGE_FAILED',
  EMAIL_CHANGE_UNAUTHORIZED: 'EMAIL_CHANGE_UNAUTHORIZED',
  EMAIL_CHANGE_ALREADY_EXISTS: 'EMAIL_CHANGE_ALREADY_EXISTS',
export const BaseErrorCategory = {
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION: 'VALIDATION',
  AUTHENTICATION: 'AUTHENTICATION',
  DATABASE: 'DATABASE',
  NETWORK: 'NETWORK',
  TIMEOUT: 'TIMEOUT',
  RATE_LIMIT: 'RATE_LIMIT',
  THROTTLING: 'THROTTLING',
  CONFLICT: 'CONFLICT',
  GATEWAY_TIMEOUT: 'GATEWAY_TIMEOUT',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type BaseErrorCategory = typeof BaseErrorCategory[keyof typeof BaseErrorCategory];

export const BaseErrorCode = {
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  THROTTLING_ERROR: 'THROTTLING_ERROR',
  CONFLICT_ERROR: 'CONFLICT_ERROR',
  GATEWAY_TIMEOUT_ERROR: 'GATEWAY_TIMEOUT_ERROR',
  SERVICE_UNAVAILABLE_ERROR: 'SERVICE_UNAVAILABLE_ERROR',
} as const;

export type BaseErrorCode = typeof BaseErrorCode[keyof typeof BaseErrorCode];

export interface AppError extends Error {
  code: BaseErrorCode | string;
  category: BaseErrorCategory | string;
  details?: Record<string, unknown>;
  statusCode?: number;
}

export class AppError extends Error {
  code: BaseErrorCode | string;
  category: BaseErrorCategory | string;
  details?: Record<string, unknown>;
  statusCode?: number;

  constructor(
    category: BaseErrorCategory | string,
    code: BaseErrorCode | string,
    message: string,
    details?: Record<string, unknown>,
    statusCode?: number
  ) {
    super(message);
    this.code = code;
    this.category = category;
    this.details = details;
    this.statusCode = statusCode;
  }

  static fromZodError(error: ZodError): AppError {
    return new AppError(
      'Validation failed',
      ErrorCategory.VALIDATION,
      undefined,
      undefined,
      {
        validationErrors: error.errors.map((issue: ZodIssue) => ({
          path: issue.path,
          message: issue.message,
          type: issue.code
        }))
      }
    );
  }

  static fromDatabaseError(error: Error): AppError {
    if (error.name === 'ValidationError') {
      return new AppError(
        ErrorCode.INVALID_FIELD_VALUE,
        'Database validation failed',
        ErrorCategory.VALIDATION,
        undefined,
        undefined,
        {
          validationErrors: (error as any).errors.map((e: any) => ({
            path: e.path,
            message: e.message,
            type: e.type
          }))
        }
      );
    } else if (error.message.includes('duplicate key')) {
      return new AppError(
        ErrorCode.DUPLICATE_ENTRY,
        'Duplicate entry',
        ErrorCategory.DATABASE,
        undefined,
        undefined,
        {
          field: error.message.match(/"(.+?)"/)?.[1]
        }
      );
    } else if (error.message.includes('foreign key')) {
      return new AppError(
        ErrorCode.FOREIGN_KEY_CONSTRAINT_VIOLATION,
        'Foreign key constraint violation',
        ErrorCategory.DATABASE,
        undefined,
        undefined,
        {
          constraint: 'foreign_key'
        }
      );
    } else {
      return new AppError(
        ErrorCode.INTERNAL_SERVER_ERROR,
        'Database error',
        ErrorCategory.DATABASE,
        undefined,
        undefined,
        {
          message: error.message
        }
      );
    }
  }

  static fromAuthenticationError(error: Error): AppError {
    return new AppError(
      ErrorCode.EXPIRED_TOKEN,
      'Authentication failed',
      ErrorCategory.AUTHENTICATION,
      undefined,
      undefined,
      {
        message: error.message
      }
    );
  }

  get status(): number {
    switch (this.code) {
      case ErrorCode.INVALID_FIELD_VALUE:
      case ErrorCode.INVALID_FORMAT:
      case ErrorCode.INVALID_PERMISSION:
        return 400;
      case ErrorCode.UNAUTHORIZED:
      case ErrorCode.EXPIRED_TOKEN:
        return 401;
      case ErrorCode.FORBIDDEN:
        return 403;
      case ErrorCode.NOT_FOUND:
        return 404;
      case ErrorCode.METHOD_NOT_ALLOWED:
        return 405;
      case ErrorCode.NOT_ACCEPTABLE:
        return 406;
      case ErrorCode.REQUEST_TIMEOUT:
        return 408;
      case ErrorCode.CONFLICT:
        return 409;
      case ErrorCode.GONE:
        return 410;
      case ErrorCode.LENGTH_REQUIRED:
        return 411;
      case ErrorCode.PRECONDITION_FAILED:
        return 412;
      case ErrorCode.PAYLOAD_TOO_LARGE:
        return 413;
      case ErrorCode.URI_TOO_LONG:
        return 414;
      case ErrorCode.UNSUPPORTED_MEDIA_TYPE:
        return 415;
      case ErrorCode.RANGE_NOT_SATISFIABLE:
        return 416;
      case ErrorCode.EXPECTATION_FAILED:
        return 417;
      case ErrorCode.IM_A_TEAPOT:
        return 418;
      case ErrorCode.MISDIRECTED_REQUEST:
        return 421;
      case ErrorCode.UNPROCESSABLE_ENTITY:
        return 422;
      case ErrorCode.LOCKED:
        return 423;
      case ErrorCode.FAILED_DEPENDENCY:
        return 424;
      case ErrorCode.TOO_MANY_REQUESTS:
        return 429;
      case ErrorCode.REQUEST_HEADER_FIELDS_TOO_LARGE:
        return 431;
      case ErrorCode.UNAVAILABLE_FOR_LEGAL_REASONS:
        return 451;
      case ErrorCode.FOREIGN_KEY_CONSTRAINT_VIOLATION:
      case ErrorCode.DUPLICATE_ENTRY:
        return 400;
      case ErrorCode.INTERNAL_SERVER_ERROR:
        return 500;
      case ErrorCode.NOT_IMPLEMENTED:
        return 501;
      case ErrorCode.BAD_GATEWAY:
        return 502;
      case ErrorCode.SERVICE_UNAVAILABLE:
        return 503;
      case ErrorCode.GATEWAY_TIMEOUT:
        return 504;
      case ErrorCode.HTTP_VERSION_NOT_SUPPORTED:
        return 505;
      case ErrorCode.VARIANT_ALSO_NEGOTIATES:
        return 506;
      case ErrorCode.INSUFFICIENT_STORAGE:
        return 507;
      case ErrorCode.LOOP_DETECTED:
        return 508;
      case ErrorCode.NOT_EXTENDED:
        return 510;
      case ErrorCode.NETWORK_AUTHENTICATION_REQUIRED:
        return 511;
      default:
        return 500;
    }
  }
}
