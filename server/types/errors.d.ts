// This file is deprecated. All error types are now defined in shared/types/errors.ts
// Please update imports to point to the shared location.

// Re-exporting from the shared location for any legacy imports.
// It's recommended to update imports directly to 'shared/types/errors'.
export { 
    AppError, 
    ErrorCode, 
    ErrorCategory, 
    BaseError, 
    RetryableError 
} from '../../shared/types/errors';
