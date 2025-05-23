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
  category: ImportExportErrorCategory;
  code: ImportExportErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export const ImportExportErrorCodes = {
  INVALID_FILE: 'INVALID_FILE',
  PROCESSING_ERROR: 'PROCESSING_ERROR',
  INVALID_FORMAT: 'INVALID_FORMAT',
  EXPORT_ERROR: 'EXPORT_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR'
} as const;

export const ImportExportErrorCategories = {
  IMPORT_EXPORT: 'IMPORT_EXPORT',
  PROCESSING: 'PROCESSING',
  INVALID_FORMAT: 'INVALID_FORMAT',
  EXPORT_ERROR: 'EXPORT_ERROR',
  DATABASE: 'DATABASE'
} as const;

export const ImportExportErrors: Record<ImportExportErrorCode, ImportExportError> = {
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
