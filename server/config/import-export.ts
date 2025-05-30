import { AppError, ErrorCode, ErrorCategory } from '@shared/types/errors';

export interface ImportExportConfig {
  batchSize: number;
  maxFileSize: number; // in bytes
  supportedFormats: string[];
  progressUpdateInterval: number; // in milliseconds
  retryConfig: {
    maxAttempts: number;
    initialDelay: number; // in milliseconds
    maxDelay: number; // in milliseconds
    backoffFactor: number;
  };
  storage: {
    type: 'local';
    path: string;
  };
  errorHandling: {
    cleanupTimeout: number; // in milliseconds
    maxErrorLogSize: number;
    maxRetryAttempts: number;
    initialRetryDelay: number; // in milliseconds
    maxRetryDelay: number; // in milliseconds
    backoffFactor: number;
  };
}

export const defaultImportExportConfig: ImportExportConfig = {
  batchSize: 100,
  maxFileSize: 5 * 1024 * 1024, // 5MB
  supportedFormats: ['csv', 'xlsx', 'json'],
  progressUpdateInterval: 1000, // 1 second
  retryConfig: {
    maxAttempts: 3,
    initialDelay: 1000, // 1 second
    maxDelay: 30000, // 30 seconds
    backoffFactor: 2
  },
  storage: {
    type: 'local',
    path: './imports'
  },
  errorHandling: {
    cleanupTimeout: 300000, // 5 minutes
    maxErrorLogSize: 100,
    maxRetryAttempts: 3,
    initialRetryDelay: 1000, // 1 second
    maxRetryDelay: 30000, // 30 seconds
    backoffFactor: 2
  }
};

export interface ImportExportError extends AppError {
  code: ErrorCode;
  category: ErrorCategory;
  retryable?: boolean;
  retryDelay?: number;
  context?: unknown;
}

export const ImportExportServiceErrors = {
  INVALID_FILE_FORMAT: new AppError(
    'Invalid file format',
    ErrorCategory.VALIDATION,
    ErrorCode.INVALID_FIELD_VALUE,
    { retryable: false, userMessage: 'Please upload a supported file format' },
    400
  ),
  FILE_TOO_LARGE: new AppError(
    'File size exceeds maximum allowed size',
    ErrorCategory.VALIDATION,
    ErrorCode.INVALID_FIELD_VALUE,
    { retryable: false, userMessage: 'Please upload a smaller file' },
    400
  ),
  INVALID_DATA: new AppError(
    'Invalid data format',
    ErrorCategory.VALIDATION,
    ErrorCode.INVALID_FIELD_VALUE,
    { retryable: false, userMessage: 'Data format is invalid' },
    400
  ),
  PROCESSING_ERROR: new AppError(
    'Failed to process file',
    ErrorCategory.SYSTEM,
    ErrorCode.INTERNAL_SERVER_ERROR,
    { retryable: true, retryDelay: 5000, userMessage: 'Failed to process file. Please try again' },
    500
  ),
  STORAGE_ERROR: new AppError(
    'Failed to store file',
    ErrorCategory.SYSTEM,
    ErrorCode.INTERNAL_SERVER_ERROR,
    { retryable: true, retryDelay: 5000, userMessage: 'Failed to store file. Please try again' },
    500
  ),
  PROGRESS_ERROR: new AppError(
    'Failed to update progress',
    ErrorCategory.SYSTEM,
    ErrorCode.INTERNAL_SERVER_ERROR,
    { retryable: true, retryDelay: 5000, userMessage: 'Failed to update progress. Please try again' },
    500
  )
};
