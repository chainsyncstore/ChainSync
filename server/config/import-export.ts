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
    type: 'local' | 's3';
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
  context?: any;
}

export const ImportExportServiceErrors = {
  INVALID_FILE_FORMAT: new AppError(
    'Invalid file format',
    ErrorCode.INVALID_FIELD_VALUE,
    ErrorCategory.VALIDATION,
    false,
    undefined,
    'Please upload a supported file format'
  ),
  FILE_TOO_LARGE: new AppError(
    'File size exceeds maximum allowed size',
    ErrorCode.INVALID_FIELD_VALUE,
    ErrorCategory.VALIDATION,
    false,
    undefined,
    'Please upload a smaller file'
  ),
  INVALID_DATA: new AppError(
    'Invalid data format',
    ErrorCode.INVALID_FIELD_VALUE,
    ErrorCategory.VALIDATION,
    false,
    undefined,
    'Data format is invalid'
  ),
  PROCESSING_ERROR: new AppError(
    'Failed to process file',
    ErrorCode.INTERNAL_SERVER_ERROR,
    ErrorCategory.SYSTEM,
    true,
    5000,
    'Failed to process file. Please try again'
  ),
  STORAGE_ERROR: new AppError(
    'Failed to store file',
    ErrorCode.INTERNAL_SERVER_ERROR,
    ErrorCategory.SYSTEM,
    true,
    5000,
    'Failed to store file. Please try again'
  ),
  PROGRESS_ERROR: new AppError(
    'Failed to update progress',
    ErrorCode.INTERNAL_SERVER_ERROR,
    ErrorCategory.SYSTEM,
    true,
    5000,
    'Failed to update progress. Please try again'
  )
};

export const defaultImportExportConfig: ImportExportConfig = {
  batchSize: 100,
  maxFileSize: 5 * 1024 * 1024, // 5MB
  supportedFormats: ['csv', 'xlsx', 'json'],
  progressUpdateInterval: 1000, // 1 second
  retryConfig: {
    maxRetries: 3,
    delay: 1000 // 1 second
  },
  storage: {
    type: 'local',
    path: './imports'
  }
};
