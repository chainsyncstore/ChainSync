"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultFileUploadConfig = exports.FileUploadErrors = void 0;
const error_1 = require("../middleware/types/error");
exports.FileUploadErrors = {
    FILE_TOO_LARGE: {
        category: error_1.ErrorCategory.VALIDATION,
        code: error_1.ErrorCode.FILE_TOO_LARGE,
        message: 'File size exceeds maximum allowed size',
        data: { fileSize: undefined },
        status: 400,
        retryable: false,
        retryDelay: undefined
    },
    INVALID_FILE_TYPE: {
        category: error_1.ErrorCategory.VALIDATION,
        code: error_1.ErrorCode.INVALID_FILE,
        message: 'Invalid file type',
        data: { fileType: undefined },
        status: 400,
        retryable: false,
        retryDelay: undefined
    },
    TOO_MANY_FILES: {
        category: error_1.ErrorCategory.VALIDATION,
        code: error_1.ErrorCode.UPLOAD_LIMIT_EXCEEDED,
        message: 'Too many files uploaded',
        data: { fileCount: undefined },
        status: 400,
        retryable: false,
        retryDelay: undefined
    },
    UPLOAD_FAILED: {
        category: error_1.ErrorCategory.SYSTEM,
        code: error_1.ErrorCode.INTERNAL_ERROR,
        message: 'Failed to upload file',
        data: { error: undefined },
        status: 500,
        retryable: true,
        retryDelay: 5000
    },
    STORAGE_ERROR: {
        category: error_1.ErrorCategory.SYSTEM,
        code: error_1.ErrorCode.INTERNAL_ERROR,
        message: 'Failed to store uploaded file',
        data: { error: undefined },
        status: 500,
        retryable: true,
        retryDelay: 5000
    },
    INVALID_FILE_NAME: {
        category: error_1.ErrorCategory.VALIDATION,
        code: error_1.ErrorCode.INVALID_FILE,
        message: 'Invalid file name',
        data: { fileName: undefined },
        status: 400,
        retryable: false,
        retryDelay: undefined,
        description: 'Please use a valid file name'
    }
};
exports.defaultFileUploadConfig = {
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
