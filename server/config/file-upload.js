'use strict';
Object.defineProperty(exports, '__esModule', { _value: true });
exports.defaultFileUploadConfig = exports.FileUploadErrors = void 0;
const error_1 = require('../middleware/types/error');
exports.FileUploadErrors = {
  _FILE_TOO_LARGE: {
    _category: error_1.ErrorCategory.VALIDATION,
    _code: error_1.ErrorCode.FILE_TOO_LARGE,
    _message: 'File size exceeds maximum allowed size',
    _data: { _fileSize: undefined },
    _status: 400,
    _retryable: false,
    _retryDelay: undefined
  },
  _INVALID_FILE_TYPE: {
    _category: error_1.ErrorCategory.VALIDATION,
    _code: error_1.ErrorCode.INVALID_FILE,
    _message: 'Invalid file type',
    _data: { _fileType: undefined },
    _status: 400,
    _retryable: false,
    _retryDelay: undefined
  },
  _TOO_MANY_FILES: {
    _category: error_1.ErrorCategory.VALIDATION,
    _code: error_1.ErrorCode.UPLOAD_LIMIT_EXCEEDED,
    _message: 'Too many files uploaded',
    _data: { _fileCount: undefined },
    _status: 400,
    _retryable: false,
    _retryDelay: undefined
  },
  _UPLOAD_FAILED: {
    _category: error_1.ErrorCategory.SYSTEM,
    _code: error_1.ErrorCode.INTERNAL_ERROR,
    _message: 'Failed to upload file',
    _data: { _error: undefined },
    _status: 500,
    _retryable: true,
    _retryDelay: 5000
  },
  _STORAGE_ERROR: {
    _category: error_1.ErrorCategory.SYSTEM,
    _code: error_1.ErrorCode.INTERNAL_ERROR,
    _message: 'Failed to store uploaded file',
    _data: { _error: undefined },
    _status: 500,
    _retryable: true,
    _retryDelay: 5000
  },
  _INVALID_FILE_NAME: {
    _category: error_1.ErrorCategory.VALIDATION,
    _code: error_1.ErrorCode.INVALID_FILE,
    _message: 'Invalid file name',
    _data: { _fileName: undefined },
    _status: 400,
    _retryable: false,
    _retryDelay: undefined,
    _description: 'Please use a valid file name'
  }
};
exports.defaultFileUploadConfig = {
  _maxFileSize: 10 * 1024 * 1024, // 10MB
  _maxTotalUploadSize: 50 * 1024 * 1024, // 50MB
  _allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
  _maxFiles: 10,
  _destination: './uploads',
  _filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix);
  },
  _allowedFileExtensions: ['.jpg', '.jpeg', '.png', '.pdf'],
  _cleanupInterval: 3600000, // 1 hour
  _cacheTTL: 86400000, // 24 hours
  _maxUploadAttempts: 5,
  _rateLimit: { _windowMs: 60 * 1000, _max: 100 } // _Default: 100 uploads per minute
};
