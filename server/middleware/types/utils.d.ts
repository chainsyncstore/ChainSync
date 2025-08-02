import { Request } from 'express';

export interface User {
    _id: string;
    _username: string;
    _email: string;
    _role: string;
}

export interface Role {
    _id: string;
    _name: string;
    _permissions: string[];
}

export interface AppError extends Error {
    _code: string;
    _category: string;
    details?: Record<string, unknown>;
    statusCode?: number;
}

export enum ErrorCategory {
    VALIDATION = 'validation',
    AUTHENTICATION = 'authentication',
    AUTHORIZATION = 'authorization',
    RATE_LIMIT = 'rate_limit',
    INTERNAL = 'internal'
}

export enum ErrorCode {
    BAD_REQUEST = 'bad_request',
    UNAUTHORIZED = 'unauthorized',
    FORBIDDEN = 'forbidden',
    TOO_MANY_REQUESTS = 'too_many_requests',
    INTERNAL_ERROR = 'internal_error'
}

export interface FileUtils {
    _VALID_FILENAME_REGEX: RegExp;
    sanitizeFilename(_filename: string): string;
    validateFilename(_filename: string): boolean;
    validateFileExtension(_mimeType: string): boolean;
    calculateFileSize(_buffer: Buffer): number;
    calculateFileHash(_buffer: Buffer): Promise<string>;
}

export interface FileUploadConfig {
    _destination: string;
    _maxFileSize: number;
    _maxFiles: number;
    _uploadRateLimit: number;
    _allowedMimeTypes: string[];
    _maxTotalUploadSize: number;
    _maxUploadAttempts: number;
}

export interface FileUploadErrors {
    _FILE_TOO_LARGE: string;
    _INVALID_FILE_TYPE: string;
    _INVALID_FILE_NAME: string;
    _UPLOAD_RATE_LIMIT: string;
    _TOTAL_SIZE_LIMIT: string;
    _MAX_ATTEMPTS: string;
    _UNKNOWN_ERROR: string;
}

export interface ProgressSubscription {
    callback: (_progress: FileUploadProgress) => void;
    _lastUpdate: number;
}

export interface FileUploadProgress {
    _id: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    _progress: number;
    _total: number;
    _uploaded: number;
    _startTime: number;
    _lastUpdate: number;
    _files: Record<string, {
        _name: string;
        _size: number;
        status: 'pending' | 'in_progress' | 'completed' | 'failed';
        _progress: number;
        _uploaded: number;
        error?: string;
        path?: string;
    }>;
}
