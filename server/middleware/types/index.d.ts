import { Request, Response, NextFunction } from 'express';
import { Multer } from 'multer';
import { LRUCache } from 'lru-cache';

// Type definitions
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
        [key: string]: any;
      };
      progressId?: string;
      files?: { [fieldname: string]: Express.Multer.File[] } | Express.Multer.File[];
    }
  }
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

export interface FileUploadConfig {
  maxFileSize: number;
  maxFiles: number;
  uploadRateLimit: number;
  maxTotalUploadSize: number;
  maxUploadAttempts: number;
  allowedFileExtensions: string[];
  allowedMimeTypes: string[];
  uploadDir: string;
  cleanupInterval: number;
  validationCacheTTL: number;
  rateLimit: {
    windowMs: number;
    max: number;
  };
}

export interface ProgressSubscription {
  id: string;
  progressId: string;
  callback: (progress: FileUploadProgress) => void;
  lastUpdate: number;
}

export interface MemoryUsageStats {
  heapTotal: number;
  heapUsed: number;
  external: number;
  timestamp: number;
}

export interface FileValidationCache {
  extension: boolean;
  filename: boolean;
  timestamp: number;
}

export interface MulterFile extends Express.Multer.File {
  buffer?: Buffer;
}

export interface MulterRequest extends Request {
  files?: { [fieldname: string]: Express.Multer.File[] } | Express.Multer.File[];
}

export type MulterInstance = Multer.Instance;

export interface AppError {
  code: string;
  category: string;
  message: string;
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
