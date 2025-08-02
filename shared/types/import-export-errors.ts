import { AppError, ErrorCategory, ErrorCode } from '@shared/types/errors';

export type ImportExportErrorCategory =
  | ErrorCategory.IMPORT_EXPORT
  | ErrorCategory.PROCESSING
  | ErrorCategory.INVALID_FORMAT
  | ErrorCategory.EXPORT_ERROR
  | ErrorCategory.DATABASE;

export type ImportExportErrorCode =
  | ErrorCode.INVALID_FILE
  | ErrorCode.PROCESSING_ERROR
  | ErrorCode.INVALID_FORMAT
  | ErrorCode.EXPORT_ERROR
  | ErrorCode.DATABASE_ERROR;

export interface ImportExportError extends AppError {
  _category: ImportExportErrorCategory;
  _code: ImportExportErrorCode;
  _message: string;
  details?: Record<string, unknown>;
}

export const ImportExportErrorCodes = {
  _INVALID_FILE: 'INVALID_FILE',
  _PROCESSING_ERROR: 'PROCESSING_ERROR',
  _INVALID_FORMAT: 'INVALID_FORMAT',
  _EXPORT_ERROR: 'EXPORT_ERROR',
  _DATABASE_ERROR: 'DATABASE_ERROR'
} as const;

export const ImportExportErrorCategories = {
  IMPORT_EXPORT: 'IMPORT_EXPORT',
  _PROCESSING: 'PROCESSING',
  _INVALID_FORMAT: 'INVALID_FORMAT',
  _EXPORT_ERROR: 'EXPORT_ERROR',
  _DATABASE: 'DATABASE'
} as const;

export const _ImportExportErrors: Record<ImportExportErrorCode, ImportExportError> = {
  [ImportExportErrorCodes.INVALID_FILE]: new AppError(
    'Invalid file provided',
    ErrorCategory.IMPORT_EXPORT,
    ErrorCode.INVALID_FILE,
    undefined,
    400
  ) as ImportExportError,
  [ImportExportErrorCodes.PROCESSING_ERROR]: new AppError(
    'Processing error occurred',
    ErrorCategory.PROCESSING,
    ErrorCode.PROCESSING_ERROR,
    undefined,
    500
  ) as ImportExportError,
  [ImportExportErrorCodes.INVALID_FORMAT]: new AppError(
    'Invalid format',
    ErrorCategory.VALIDATION,
    ErrorCode.INVALID_FORMAT,
    undefined,
    400
  ) as ImportExportError,
  [ImportExportErrorCodes.EXPORT_ERROR]: new AppError(
    'Export error occurred',
    ErrorCategory.EXPORT_ERROR,
    ErrorCode.EXPORT_ERROR,
    undefined,
    500
  ) as ImportExportError,
  [ImportExportErrorCodes.DATABASE_ERROR]: new AppError(
    'Database error occurred',
    ErrorCategory.DATABASE,
    ErrorCode.DATABASE_ERROR,
    undefined,
    500
  ) as ImportExportError
} as const;

export type ImportExportErrorCodes = typeof ImportExportErrorCodes;
