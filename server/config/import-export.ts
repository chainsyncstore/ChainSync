import { AppError, ErrorCode, ErrorCategory } from '@shared/types/errors';

export interface ImportExportConfig {
  _batchSize: number;
  _maxFileSize: number; // in bytes
  _supportedFormats: string[];
  _progressUpdateInterval: number; // in milliseconds
  retryConfig: {
    _maxAttempts: number;
    _initialDelay: number; // in milliseconds
    _maxDelay: number; // in milliseconds
    _backoffFactor: number;
  };
  storage: {
    type: 'local';
    _path: string;
  };
  errorHandling: {
    _cleanupTimeout: number; // in milliseconds
    _maxErrorLogSize: number;
    _maxRetryAttempts: number;
    _initialRetryDelay: number; // in milliseconds
    _maxRetryDelay: number; // in milliseconds
    _backoffFactor: number;
  };
}

export const _defaultImportExportConfig: ImportExportConfig = {
  _batchSize: 100,
  _maxFileSize: 5 * 1024 * 1024, // 5MB
  _supportedFormats: ['csv', 'xlsx', 'json'],
  _progressUpdateInterval: 1000, // 1 second
  _retryConfig: {
    _maxAttempts: 3,
    _initialDelay: 1000, // 1 second
    _maxDelay: 30000, // 30 seconds
    _backoffFactor: 2
  },
  _storage: {
    type: 'local',
    _path: './imports'
  },
  _errorHandling: {
    _cleanupTimeout: 300000, // 5 minutes
    _maxErrorLogSize: 100,
    _maxRetryAttempts: 3,
    _initialRetryDelay: 1000, // 1 second
    _maxRetryDelay: 30000, // 30 seconds
    _backoffFactor: 2
  }
};

export interface ImportExportError extends AppError {
  _code: ErrorCode;
  _category: ErrorCategory;
  retryable?: boolean;
  retryDelay?: number;
  context?: any;
}

export const ImportExportServiceErrors = {
  _INVALID_FILE_FORMAT: new AppError(
    'Invalid file format',
    ErrorCategory.VALIDATION,
    ErrorCode.INVALID_FIELD_VALUE,
    { _retryable: false, _userMessage: 'Please upload a supported file format' },
    400
  ),
  _FILE_TOO_LARGE: new AppError(
    'File size exceeds maximum allowed size',
    ErrorCategory.VALIDATION,
    ErrorCode.INVALID_FIELD_VALUE,
    { _retryable: false, _userMessage: 'Please upload a smaller file' },
    400
  ),
  _INVALID_DATA: new AppError(
    'Invalid data format',
    ErrorCategory.VALIDATION,
    ErrorCode.INVALID_FIELD_VALUE,
    { _retryable: false, _userMessage: 'Data format is invalid' },
    400
  ),
  _PROCESSING_ERROR: new AppError(
    'Failed to process file',
    ErrorCategory.SYSTEM,
    ErrorCode.INTERNAL_SERVER_ERROR,
    { _retryable: true, _retryDelay: 5000, _userMessage: 'Failed to process file. Please try again' },
    500
  ),
  _STORAGE_ERROR: new AppError(
    'Failed to store file',
    ErrorCategory.SYSTEM,
    ErrorCode.INTERNAL_SERVER_ERROR,
    { _retryable: true, _retryDelay: 5000, _userMessage: 'Failed to store file. Please try again' },
    500
  ),
  _PROGRESS_ERROR: new AppError(
    'Failed to update progress',
    ErrorCategory.SYSTEM,
    ErrorCode.INTERNAL_SERVER_ERROR,
    { _retryable: true, _retryDelay: 5000, _userMessage: 'Failed to update progress. Please try again' },
    500
  )
};
