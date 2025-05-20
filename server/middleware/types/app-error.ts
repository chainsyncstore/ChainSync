import { ErrorCategory, ErrorCode } from './error';

export class AppError extends Error {
    public readonly code: ErrorCode;
    public readonly category: ErrorCategory;
    public readonly details?: Record<string, unknown>;
    public readonly statusCode?: number;

    constructor(
        category: ErrorCategory,
        code: ErrorCode,
        message: string,
        details?: Record<string, unknown>,
        statusCode?: number
    ) {
        super(message);
        this.name = 'AppError';
        this.code = code;
        this.category = category;
        this.details = details;
        this.statusCode = statusCode || 500;
    }

    static create(
        category: ErrorCategory,
        code: ErrorCode,
        message: string,
        details?: Record<string, unknown>,
        statusCode?: number
    ): AppError {
        return new AppError(category, code, message, details, statusCode);
    }
}
