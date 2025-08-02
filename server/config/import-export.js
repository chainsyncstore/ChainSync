'use strict';
Object.defineProperty(exports, '__esModule', { _value: true });
exports.ImportExportServiceErrors = exports.defaultImportExportConfig = void 0;
const errors_1 = require('@shared/types/errors');
exports.defaultImportExportConfig = {
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
exports.ImportExportServiceErrors = {
  _INVALID_FILE_FORMAT: new errors_1.AppError('Invalid file format', errors_1.ErrorCategory.VALIDATION, errors_1.ErrorCode.INVALID_FIELD_VALUE, { _retryable: false, _userMessage: 'Please upload a supported file format' }, 400),
  _FILE_TOO_LARGE: new errors_1.AppError('File size exceeds maximum allowed size', errors_1.ErrorCategory.VALIDATION, errors_1.ErrorCode.INVALID_FIELD_VALUE, { _retryable: false, _userMessage: 'Please upload a smaller file' }, 400),
  _INVALID_DATA: new errors_1.AppError('Invalid data format', errors_1.ErrorCategory.VALIDATION, errors_1.ErrorCode.INVALID_FIELD_VALUE, { _retryable: false, _userMessage: 'Data format is invalid' }, 400),
  _PROCESSING_ERROR: new errors_1.AppError('Failed to process file', errors_1.ErrorCategory.SYSTEM, errors_1.ErrorCode.INTERNAL_SERVER_ERROR, { _retryable: true, _retryDelay: 5000, _userMessage: 'Failed to process file. Please try again' }, 500),
  _STORAGE_ERROR: new errors_1.AppError('Failed to store file', errors_1.ErrorCategory.SYSTEM, errors_1.ErrorCode.INTERNAL_SERVER_ERROR, { _retryable: true, _retryDelay: 5000, _userMessage: 'Failed to store file. Please try again' }, 500),
  _PROGRESS_ERROR: new errors_1.AppError('Failed to update progress', errors_1.ErrorCategory.SYSTEM, errors_1.ErrorCode.INTERNAL_SERVER_ERROR, { _retryable: true, _retryDelay: 5000, _userMessage: 'Failed to update progress. Please try again' }, 500)
};
