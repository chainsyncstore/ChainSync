import { Request, Response, NextFunction } from 'express';
import 'multer';
import { LRUCache } from 'lru-cache';

// Type definitions
declare global {
  namespace Express {
    interface Request {
      user?: {
        _id: string;
        _role: string;
        [_key: string]: any;
      };
      progressId?: string;
      files?: { [_fieldname: string]: Express.Multer.File[] } | Express.Multer.File[];
    }
  }
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

export interface FileUploadConfig {
  _maxFileSize: number;
  _maxFiles: number;
  _uploadRateLimit: number;
  _maxTotalUploadSize: number;
  _maxUploadAttempts: number;
  _allowedFileExtensions: string[];
  _allowedMimeTypes: string[];
  _uploadDir: string;
  _cleanupInterval: number;
  _validationCacheTTL: number;
  rateLimit: {
    _windowMs: number;
    _max: number;
  };
}

export interface ProgressSubscription {
  id?: string;
  _progressId: string;
  callback: (_progress: FileUploadProgress) => void;
  _lastUpdate: number;
}

export interface MemoryUsageStats {
  _heapTotal: number;
  _heapUsed: number;
  _external: number;
  _timestamp: number;
}

export interface FileValidationCache {
  _extension: boolean;
  _filename: boolean;
  _timestamp: number;
}

export interface MulterRequest extends Request {
  files?: { [_fieldname: string]: Express.Multer.File[] } | Express.Multer.File[];
}

export type MulterInstance = import('multer').Multer;

export interface AppError {
  _code: string;
  _category: string;
  _message: string;
  details?: Record<string, unknown>;
  statusCode?: number;
}

export enum ErrorCategory {
  VALIDATION = 'VALIDATION',
  AUTH = 'AUTH',
  SYSTEM = 'SYSTEM'
}

export enum ErrorCode {
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  UPLOAD_LIMIT_EXCEEDED = 'UPLOAD_LIMIT_EXCEEDED',
  INVALID_FILENAME = 'INVALID_FILENAME',
  UPLOAD_FAILED = 'UPLOAD_FAILED'
}
