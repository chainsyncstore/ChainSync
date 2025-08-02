'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.ImportExportServiceErrors = exports.defaultImportExportConfig = void 0;
const errors_1 = require('@shared/types/errors');
exports.defaultImportExportConfig = {
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
exports.ImportExportServiceErrors = {
  INVALID_FILE_FORMAT: new errors_1.AppError('Invalid file format', errors_1.ErrorCategory.VALIDATION, errors_1.ErrorCode.INVALID_FIELD_VALUE, { retryable: false, userMessage: 'Please upload a supported file format' }, 400),
  FILE_TOO_LARGE: new errors_1.AppError('File size exceeds maximum allowed size', errors_1.ErrorCategory.VALIDATION, errors_1.ErrorCode.INVALID_FIELD_VALUE, { retryable: false, userMessage: 'Please upload a smaller file' }, 400),
  INVALID_DATA: new errors_1.AppError('Invalid data format', errors_1.ErrorCategory.VALIDATION, errors_1.ErrorCode.INVALID_FIELD_VALUE, { retryable: false, userMessage: 'Data format is invalid' }, 400),
  PROCESSING_ERROR: new errors_1.AppError('Failed to process file', errors_1.ErrorCategory.SYSTEM, errors_1.ErrorCode.INTERNAL_SERVER_ERROR, { retryable: true, retryDelay: 5000, userMessage: 'Failed to process file. Please try again' }, 500),
  STORAGE_ERROR: new errors_1.AppError('Failed to store file', errors_1.ErrorCategory.SYSTEM, errors_1.ErrorCode.INTERNAL_SERVER_ERROR, { retryable: true, retryDelay: 5000, userMessage: 'Failed to store file. Please try again' }, 500),
  PROGRESS_ERROR: new errors_1.AppError('Failed to update progress', errors_1.ErrorCategory.SYSTEM, errors_1.ErrorCode.INTERNAL_SERVER_ERROR, { retryable: true, retryDelay: 5000, userMessage: 'Failed to update progress. Please try again' }, 500)
};
