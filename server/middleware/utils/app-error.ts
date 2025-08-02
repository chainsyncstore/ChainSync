import { ErrorCategory, ErrorCode } from '../types/error';

export class AppError extends Error {
  _code: string;
  _category: string;
  details?: Record<string, unknown> | undefined;
  statusCode?: number | undefined;

  constructor(
    _category: ErrorCategory | string,
    _code: ErrorCode | string,
    _message: string,
    details?: Record<string, unknown>,
    statusCode?: number
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.category = category;
    this.details = details as Record<string, unknown> | undefined;
    this.statusCode = statusCode as number | undefined;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static create(
    _category: ErrorCategory | string,
    _code: ErrorCode | string,
    _message: string,
    details?: Record<string, unknown>,
    statusCode?: number
  ): AppError {
    return new AppError(category, code, message, details, statusCode);
  }
}
