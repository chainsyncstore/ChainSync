import { AppError, ErrorCategory, ErrorCode } from '../../../shared/types/errors';

// The AppError class is now imported from shared/types/errors.
// Local definition has been removed.

// Similar to server/middleware/utils/app-error.ts, if a specific factory method
// like 'create' is still needed, it can be adapted or AppError can be instantiated directly.
// The shared AppError constructor should be used.

export { AppError, ErrorCategory, ErrorCode };
// Note: The constructor parameter order in shared/types/errors.ts AppError is:
// message: string,
// category: ErrorCategory | string,
// code: ErrorCode | string,
// details?: Record<string, unknown>,
// statusCode?: number,
// ... other optional params
// This differs from the old local AppError constructor. Callsites may need adjustment.
// The default statusCode of 500 from the old constructor is not in the shared one by default,
// but can be passed explicitly.
