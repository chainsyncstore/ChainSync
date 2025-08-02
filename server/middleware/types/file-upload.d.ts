import { Request, Response, NextFunction } from 'express';
import { File } from 'multer';

export interface FileUploadConfig {
  _maxFileSize: number;
  _maxTotalUploadSize: number;
  _allowedMimeTypes: string[];
  _maxFiles: number;
  _destination: string;
  filename: (_req: Request, _file: File, _cb: (_error: Error | null, _filename: string)
   = > void) => void;
  _allowedFileExtensions: string[];
  _cleanupInterval: number;
  _cacheTTL: number;
  _maxUploadAttempts: number;
  _uploadRateLimit: number;
}

export interface FileUploadError {
  retryable?: boolean;
  retryAfter?: number;
  validationErrors?: Record<string, string[]>;
}

export interface FileUploadProgress {
  _id: string;
  status: 'in_progress' | 'completed' | 'failed';
  _progress: number;
  _total: number;
  _uploaded: number;
  _startTime: number;
  _lastUpdate: number;
  _files: Record<string, FileProgress>;
}

export interface FileProgress {
  _name: string;
  _size: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  _progress: number;
  _uploaded: number;
  path?: string;
}

export interface ProgressSubscription {
  _progressId: string;
  onProgress: (_progress: FileUploadProgress) => void;
  _onError: (_error: FileUploadError) => void;
  _onComplete: (_result: any) => void;
}

export interface MulterOptions {
  dest?: string;
  fileFilter?: (_req: Request, _file: File, _cb: (_error: Error | null, _acceptFile: boolean)
   = > void) => void;
  limits?: {
    fileSize?: number;
    files?: number;
  };
}

export interface MulterInstance {
  single(_fieldname: string): (_req: Request, _res: Response, _next: NextFunction) => void;
  array(_fieldname: string, maxCount?: number): (_req: Request, _res: Response, _next: NextFunction)
   = > void;
  fields(_fields: Array<{ _name: string; _maxCount: number }>): (_req: Request, _res: Response, _next: NextFunction)
   = > void;
  any(): (_req: Request, _res: Response, _next: NextFunction) => void;
  none(): (_req: Request, _res: Response, _next: NextFunction) => void;
}

export interface Multer {
  new (options?: MulterOptions): MulterInstance;
}

export interface FileUploadMiddleware {
  _upload: Multer;
  validateUploadedFiles(_req: Request, _res: Response, _next: (error?: Error | null)
   = > void): Promise<void>;
  updateProgress(_req: Request, _file: MulterFile, _progress: number): void;
  cleanupResources(): void;
  startPeriodicCleanup(): void;
  validateFileExtension(_mimeType: string): boolean;
  validateFilename(_filename: string): boolean;
  getInstance(): FileUploadMiddleware;
}
