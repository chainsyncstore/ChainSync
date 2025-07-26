"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportExportErrors = exports.ImportExportErrorCategories = exports.ImportExportErrorCodes = void 0;
const errors_1 = require("@shared/types/errors");
exports.ImportExportErrorCodes = {
    INVALID_FILE: 'INVALID_FILE',
    PROCESSING_ERROR: 'PROCESSING_ERROR',
    INVALID_FORMAT: 'INVALID_FORMAT',
    EXPORT_ERROR: 'EXPORT_ERROR',
    DATABASE_ERROR: 'DATABASE_ERROR'
};
exports.ImportExportErrorCategories = {
    IMPORT_EXPORT: 'IMPORT_EXPORT',
    PROCESSING: 'PROCESSING',
    INVALID_FORMAT: 'INVALID_FORMAT',
    EXPORT_ERROR: 'EXPORT_ERROR',
    DATABASE: 'DATABASE'
};
exports.ImportExportErrors = {
    [exports.ImportExportErrorCodes.INVALID_FILE]: new errors_1.AppError('Invalid file provided', errors_1.ErrorCategory.IMPORT_EXPORT, errors_1.ErrorCode.INVALID_FILE, undefined, 400),
    [exports.ImportExportErrorCodes.PROCESSING_ERROR]: new errors_1.AppError('Processing error occurred', errors_1.ErrorCategory.PROCESSING, errors_1.ErrorCode.PROCESSING_ERROR, undefined, 500),
    [exports.ImportExportErrorCodes.INVALID_FORMAT]: new errors_1.AppError('Invalid format', errors_1.ErrorCategory.VALIDATION, errors_1.ErrorCode.INVALID_FORMAT, undefined, 400),
    [exports.ImportExportErrorCodes.EXPORT_ERROR]: new errors_1.AppError('Export error occurred', errors_1.ErrorCategory.EXPORT_ERROR, errors_1.ErrorCode.EXPORT_ERROR, undefined, 500),
    [exports.ImportExportErrorCodes.DATABASE_ERROR]: new errors_1.AppError('Database error occurred', errors_1.ErrorCategory.DATABASE, errors_1.ErrorCode.DATABASE_ERROR, undefined, 500)
};
