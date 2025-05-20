export enum ErrorCategory {
  VALIDATION = 'validation',
  SYSTEM = 'system',
  AUTHENTICATION = 'authentication'
}

export enum ErrorCode {
  BAD_REQUEST = 'BAD_REQUEST',
  NOT_FOUND = 'NOT_FOUND',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  INVALID_FILE = 'INVALID_FILE',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  UPLOAD_LIMIT_EXCEEDED = 'UPLOAD_LIMIT_EXCEEDED',
  AUTHENTICATION = 'AUTHENTICATION'
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
