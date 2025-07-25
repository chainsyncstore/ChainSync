import { AppError, ErrorCategory, ErrorCode } from '@shared/types/errors';
export const ImportExportErrorCodes = {
    INVALID_FILE: 'INVALID_FILE',
    PROCESSING_ERROR: 'PROCESSING_ERROR',
    INVALID_FORMAT: 'INVALID_FORMAT',
    EXPORT_ERROR: 'EXPORT_ERROR',
    DATABASE_ERROR: 'DATABASE_ERROR'
};
export const ImportExportErrorCategories = {
    IMPORT_EXPORT: 'IMPORT_EXPORT',
    PROCESSING: 'PROCESSING',
    INVALID_FORMAT: 'INVALID_FORMAT',
    EXPORT_ERROR: 'EXPORT_ERROR',
    DATABASE: 'DATABASE'
};
export const ImportExportErrors = {
    [ImportExportErrorCodes.INVALID_FILE]: new AppError('Invalid file provided', ErrorCategory.IMPORT_EXPORT, ErrorCode.INVALID_FILE, undefined, 400),
    [ImportExportErrorCodes.PROCESSING_ERROR]: new AppError('Processing error occurred', ErrorCategory.PROCESSING, ErrorCode.PROCESSING_ERROR, undefined, 500),
    [ImportExportErrorCodes.INVALID_FORMAT]: new AppError('Invalid format', ErrorCategory.VALIDATION, ErrorCode.INVALID_FORMAT, undefined, 400),
    [ImportExportErrorCodes.EXPORT_ERROR]: new AppError('Export error occurred', ErrorCategory.EXPORT_ERROR, ErrorCode.EXPORT_ERROR, undefined, 500),
    [ImportExportErrorCodes.DATABASE_ERROR]: new AppError('Database error occurred', ErrorCategory.DATABASE, ErrorCode.DATABASE_ERROR, undefined, 500)
};
//# sourceMappingURL=import-export-errors.js.map