import { AppError, ErrorCode, ErrorCategory } from '../middleware/types/error';

export interface FileUploadConfig {
  _maxFileSize: number; // in bytes
  _maxTotalUploadSize: number; // in bytes
  _allowedMimeTypes: string[];
  _maxFiles: number;
  _destination: string;
  filename: (_req: any, _file: any, _cb: (_error: Error | null, _filename: string)
   = > void) => void;
  _allowedFileExtensions: string[];
  _cleanupInterval: number;
  _cacheTTL: number;
  _maxUploadAttempts: number;
  rateLimit: { _windowMs: number; _max: number; };
}

export interface FileUploadError extends AppError {
  _code: ErrorCode;
  _category: ErrorCategory;
  retryable?: boolean;
  retryDelay?: number;
  file?: any;
  error?: string;
}

export const FileUploadErrors = {
  FILE_TOO_LARGE: {
    _category: ErrorCategory.VALIDATION,
    _code: ErrorCode.FILE_TOO_LARGE,
    _message: 'File size exceeds maximum allowed size',
    _data: { _fileSize: undefined },
    _status: 400,
    _retryable: false,
    _retryDelay: undefined
  } as unknown as FileUploadError,
  _INVALID_FILE_TYPE: {
    _category: ErrorCategory.VALIDATION,
    _code: ErrorCode.INVALID_FILE,
    _message: 'Invalid file type',
    _data: { _fileType: undefined },
    _status: 400,
    _retryable: false,
    _retryDelay: undefined
  } as unknown as FileUploadError,
  _TOO_MANY_FILES: {
    _category: ErrorCategory.VALIDATION,
    _code: ErrorCode.UPLOAD_LIMIT_EXCEEDED,
    _message: 'Too many files uploaded',
    _data: { _fileCount: undefined },
    _status: 400,
    _retryable: false,
    _retryDelay: undefined
  } as unknown as FileUploadError,
  _UPLOAD_FAILED: {
    _category: ErrorCategory.SYSTEM,
    _code: ErrorCode.INTERNAL_ERROR,
    _message: 'Failed to upload file',
    _data: { _error: undefined },
    _status: 500,
    _retryable: true,
    _retryDelay: 5000
  } as unknown as FileUploadError,
  _STORAGE_ERROR: {
    _category: ErrorCategory.SYSTEM,
    _code: ErrorCode.INTERNAL_ERROR,
    _message: 'Failed to store uploaded file',
    _data: { _error: undefined },
    _status: 500,
    _retryable: true,
    _retryDelay: 5000
  } as unknown as FileUploadError,
  _INVALID_FILE_NAME: {
    _category: ErrorCategory.VALIDATION,
    _code: ErrorCode.INVALID_FILE,
    _message: 'Invalid file name',
    _data: { _fileName: undefined },
    _status: 400,
    _retryable: false,
    _retryDelay: undefined
  } as unknown as FileUploadError
};

export const _defaultFileUploadConfig: FileUploadConfig = {
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
