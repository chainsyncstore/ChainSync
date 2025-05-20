import { Request } from 'express';

export interface User {
    id: string;
    username: string;
    email: string;
    role: string;
}

export interface Role {
    id: string;
    name: string;
    permissions: string[];
}

export interface AppError extends Error {
    code: string;
    category: string;
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
    VALID_FILENAME_REGEX: RegExp;
    sanitizeFilename(filename: string): string;
    validateFilename(filename: string): boolean;
    validateFileExtension(mimeType: string): boolean;
    calculateFileSize(buffer: Buffer): number;
    calculateFileHash(buffer: Buffer): Promise<string>;
}

export interface FileUploadConfig {
    destination: string;
    maxFileSize: number;
    maxFiles: number;
    uploadRateLimit: number;
    allowedMimeTypes: string[];
    maxTotalUploadSize: number;
    maxUploadAttempts: number;
}

export interface FileUploadErrors {
    FILE_TOO_LARGE: string;
    INVALID_FILE_TYPE: string;
    INVALID_FILE_NAME: string;
    UPLOAD_RATE_LIMIT: string;
    TOTAL_SIZE_LIMIT: string;
    MAX_ATTEMPTS: string;
    UNKNOWN_ERROR: string;
}

export interface ProgressSubscription {
    callback: (progress: FileUploadProgress) => void;
    lastUpdate: number;
}

export interface FileUploadProgress {
    id: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    progress: number;
    total: number;
    uploaded: number;
    startTime: number;
    lastUpdate: number;
    files: Record<string, {
        name: string;
        size: number;
        status: 'pending' | 'in_progress' | 'completed' | 'failed';
        progress: number;
        uploaded: number;
        error?: string;
        path?: string;
    }>;
}
