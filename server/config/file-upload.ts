import { AppError, ErrorCode, ErrorCategory } from '@shared/types/errors';

export interface FileUploadConfig {
  maxFileSize: number; // in bytes
  maxTotalUploadSize: number; // in bytes
  allowedMimeTypes: string[];
  maxFiles: number;
  destination: string;
  filename: (
    req: unknown,
    file: unknown,
    cb: (error: Error | null, filename: string) => void
  ) => void;
  allowedFileExtensions: string[];
  cleanupInterval: number;
  cacheTTL: number;
  maxUploadAttempts: number;
  rateLimit: { windowMs: number; max: number };
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
  FILE_TOO_LARGE: new AppError(
    'File size exceeds maximum allowed size',
    ErrorCategory.VALIDATION,
    ErrorCode.PAYLOAD_TOO_LARGE // Corrected ErrorCode
  ),
  INVALID_FILE_CONTENT: new AppError(
    'Invalid file content or format',
    ErrorCategory.VALIDATION,
    ErrorCode.UNPROCESSABLE_ENTITY // Corrected ErrorCode
  ),
  UNTRUSTED_FILE_SOURCE: new AppError(
    'File type not allowed from untrusted source',
    ErrorCategory.VALIDATION,
    ErrorCode.FORBIDDEN // Corrected ErrorCode
  ),
  INVALID_FILE_TYPE: new AppError(
    'Invalid file type',
    ErrorCategory.VALIDATION,
    ErrorCode.UNSUPPORTED_MEDIA_TYPE // Corrected ErrorCode
  ),
  TOO_MANY_FILES: new AppError(
    'Too many files uploaded',
    ErrorCategory.VALIDATION,
    ErrorCode.PAYLOAD_TOO_LARGE // Corrected ErrorCode (or a more specific one if available)
  ),
  UPLOAD_FAILED: new AppError(
    'Failed to upload file',
    ErrorCategory.SYSTEM,
    ErrorCode.INTERNAL_SERVER_ERROR
  ),
  STORAGE_ERROR: new AppError(
    'Failed to store uploaded file',
    ErrorCategory.SYSTEM,
    ErrorCode.INTERNAL_SERVER_ERROR
  ),
  INVALID_FILE_NAME: new AppError(
    'Invalid file name',
    ErrorCategory.VALIDATION,
    ErrorCode.BAD_REQUEST // Corrected ErrorCode
  ),
};

export const defaultFileUploadConfig: FileUploadConfig = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxTotalUploadSize: 50 * 1024 * 1024, // 50MB
  allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
  maxFiles: 10,
  destination: './uploads',
  filename: (req: any, file: any, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix);
  },
  allowedFileExtensions: ['.jpg', '.jpeg', '.png', '.pdf'],
  cleanupInterval: 3600000, // 1 hour
  cacheTTL: 86400000, // 24 hours
  maxUploadAttempts: 5,
  rateLimit: { windowMs: 60 * 1000, max: 100 }, // Default: 100 uploads per minute
};
