import { AppError, ErrorCode, ErrorCategory } from '../middleware/types/error';

export interface FileUploadConfig {
  maxFileSize: number; // in bytes
  maxTotalUploadSize: number; // in bytes
  allowedMimeTypes: string[];
  maxFiles: number;
  destination: string;
  filename: (req: unknown, file: unknown, cb: (error: Error | null, filename: string) => void) => void;
  allowedFileExtensions: string[];
  cleanupInterval: number;
  cacheTTL: number;
  maxUploadAttempts: number;
  rateLimit: { windowMs: number; max: number; };
}

export interface FileUploadError extends AppError {
  code: ErrorCode;
  category: ErrorCategory;
  retryable?: boolean;
  retryDelay?: number;
  file?: unknown;
  error?: string;
}

export const FileUploadErrors = {
  FILE_TOO_LARGE: {
    category: ErrorCategory.VALIDATION,
    code: ErrorCode.FILE_TOO_LARGE,
    message: 'File size exceeds maximum allowed size',
    data: { fileSize: undefined },
  },
  INVALID_FILE_CONTENT: {
    category: ErrorCategory.VALIDATION,
    code: ErrorCode.INVALID_FILE,
    message: 'Invalid file content or format',
    retryable: false
  },
  UNTRUSTED_FILE_SOURCE: {
    category: ErrorCategory.VALIDATION,
    code: ErrorCode.INVALID_FILE,
    message: 'File type not allowed from untrusted source',
    retryable: false,
    status: 400,
    retryDelay: undefined
  } as FileUploadError,
  INVALID_FILE_TYPE: {
    category: ErrorCategory.VALIDATION,
    code: ErrorCode.INVALID_FILE,
    message: 'Invalid file type',
    data: { fileType: undefined },
    status: 400,
    retryable: false,
    retryDelay: undefined
  } as FileUploadError,
  TOO_MANY_FILES: {
    category: ErrorCategory.VALIDATION,
    code: ErrorCode.UPLOAD_LIMIT_EXCEEDED,
    message: 'Too many files uploaded',
    data: { fileCount: undefined },
    status: 400,
    retryable: false,
    retryDelay: undefined
  } as FileUploadError,
  UPLOAD_FAILED: {
    category: ErrorCategory.SYSTEM,
    code: ErrorCode.INTERNAL_ERROR,
    message: 'Failed to upload file',
    data: { error: undefined },
    status: 500,
    retryable: true,
    retryDelay: 5000
  } as FileUploadError,
  STORAGE_ERROR: {
    category: ErrorCategory.SYSTEM,
    code: ErrorCode.INTERNAL_ERROR,
    message: 'Failed to store uploaded file',
    data: { error: undefined },
    status: 500,
    retryable: true,
    retryDelay: 5000
  } as FileUploadError,
  INVALID_FILE_NAME: {
    category: ErrorCategory.VALIDATION,
    code: ErrorCode.INVALID_FILE,
    message: 'Invalid file name',
    data: { fileName: undefined },
    status: 400,
    retryable: false,
    retryDelay: undefined,
    description: 'Please use a valid file name'
  } as FileUploadError
};

export const defaultFileUploadConfig: FileUploadConfig = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxTotalUploadSize: 50 * 1024 * 1024, // 50MB
  allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
  maxFiles: 10,
  destination: './uploads',
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix);
  },
  allowedFileExtensions: ['.jpg', '.jpeg', '.png', '.pdf'],
  cleanupInterval: 3600000, // 1 hour
  cacheTTL: 86400000, // 24 hours
  maxUploadAttempts: 5,
  rateLimit: { windowMs: 60 * 1000, max: 100 } // Default: 100 uploads per minute
};
