import { ErrorCategory, ErrorCode } from './error';

export class AppError extends Error {
    public readonly _code: ErrorCode;
    public readonly _category: ErrorCategory;
    public readonly details?: Record<string, unknown> | undefined;
    public readonly statusCode?: number | undefined;

    constructor(
        _category: ErrorCategory,
        _code: ErrorCode,
        _message: string,
        details?: Record<string, unknown>,
        statusCode?: number
    ) {
        super(message);
        this.name = 'AppError';
        this.code = code;
        this.category = category;
        this.details = details as Record<string, unknown> | undefined;
        this.statusCode = statusCode || 500;
    }

    static create(
        _category: ErrorCategory,
        _code: ErrorCode,
        _message: string,
        details?: Record<string, unknown>,
        statusCode?: number
    ): AppError {
        return new AppError(category, code, message, details, statusCode);
    }
}
