import { Request, Response, NextFunction } from 'express';
import type { Multer as MulterInstanceType } from 'multer'; // Correctly import Multer instance type
import { LRUCache } from 'lru-cache';

// Type definitions
// Removed redundant global Express augmentation. This should be handled by server/types/express.d.ts
// declare global {
//   namespace Express {
//     interface Request {
//       user?: {
//         id: string;
//         role: string;
//         [key: string]: unknown;
//       };
//       progressId?: string;
//       files?: { [fieldname: string]: Express.Multer.File[] } | Express.Multer.File[];
//     }
//   }
// }

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

// Removed local MulterFile, use Express.Multer.File or import from 'multer'
// export interface MulterFile extends Express.Multer.File {
//   buffer?: Buffer;
// }

// Removed MulterRequest as Express.Request is globally augmented sufficiently
// export interface MulterRequest extends Request { 
//   files?: { [fieldname: string]: Express.Multer.File[] } | Express.Multer.File[] | Express.Multer.File; 
// }

export type MulterInstance = MulterInstanceType;

// Removed local AppError, ErrorCategory, ErrorCode. Use from shared/types/errors.ts via app-error.ts
// export interface AppError { ... }
// export enum ErrorCategory { ... }
// export enum ErrorCode { ... }
