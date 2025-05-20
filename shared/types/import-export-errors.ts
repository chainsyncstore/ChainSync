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
    'IMPORT_EXPORT',
    'INVALID_FILE',
    'Invalid file provided',
    undefined,
    400
  ),
  [ImportExportErrorCodes.PROCESSING_ERROR]: new AppError(
    'PROCESSING',
    'PROCESSING_ERROR',
    'Processing error occurred',
    undefined,
    500
  ),
  [ImportExportErrorCodes.INVALID_FORMAT]: new AppError(
    'INVALID_FORMAT',
    'INVALID_FORMAT',
    'Invalid format',
    undefined,
    400
  ),
  [ImportExportErrorCodes.EXPORT_ERROR]: new AppError(
    'EXPORT_ERROR',
    'EXPORT_ERROR',
    'Export error occurred',
    undefined,
    500
  ),
  [ImportExportErrorCodes.DATABASE_ERROR]: new AppError(
    'DATABASE',
    'DATABASE_ERROR',
    'Database error occurred',
    undefined,
    500
  )
} as const;

export type ImportExportErrorCodes = typeof ImportExportErrorCodes;
