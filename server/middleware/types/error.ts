export enum ErrorCategory {
  VALIDATION = 'validation',
  SYSTEM = 'system',
  AUTHENTICATION = 'authentication',
  DATABASE = 'database'
}

export enum ErrorCode {
  BAD_REQUEST = 'BAD_REQUEST',
  NOT_FOUND = 'NOT_FOUND',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  INVALID_FILE = 'INVALID_FILE',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  UPLOAD_LIMIT_EXCEEDED = 'UPLOAD_LIMIT_EXCEEDED',
  AUTHENTICATION = 'AUTHENTICATION',
  DATABASE_ERROR = 'DATABASE_ERROR',
  DUPLICATE_RECORD = 'DUPLICATE_RECORD',
  FOREIGN_KEY_VIOLATION = 'FOREIGN_KEY_VIOLATION',
  CHECK_VIOLATION = 'CHECK_VIOLATION',
  NOT_NULL_VIOLATION = 'NOT_NULL_VIOLATION'
}

export interface AppError {
  category: ErrorCategory;
  code: ErrorCode;
  message: string;
  data?: Record<string, any>;
  status: number;
  retryable?: boolean;
  retryAfter?: number;
  validationErrors?: Record<string, string[]>;
}
