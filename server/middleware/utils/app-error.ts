import { ErrorCategory, ErrorCode } from '../types/error';

export class AppError extends Error {
  code: string;
  category: string;
  details?: Record<string, unknown>;
  statusCode?: number;

  constructor(
    category: ErrorCategory | string,
    code: ErrorCode | string,
    message: string,
    details?: Record<string, unknown>,
    statusCode?: number
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.category = category;
    this.details = details;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static create(
    category: ErrorCategory | string,
    code: ErrorCode | string,
    message: string,
    details?: Record<string, unknown>,
    statusCode?: number
  ): AppError {
    return new AppError(category, code, message, details, statusCode);
  }
}
