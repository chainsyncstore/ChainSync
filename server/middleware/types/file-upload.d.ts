import { Request, Response, NextFunction } from 'express';
import { File } from 'multer';

export interface FileUploadConfig {
  maxFileSize: number;
  maxTotalUploadSize: number;
  allowedMimeTypes: string[];
  maxFiles: number;
  destination: string;
  filename: (req: Request, file: File, cb: (error: Error | null, filename: string) => void) => void;
  allowedFileExtensions: string[];
  cleanupInterval: number;
  cacheTTL: number;
  maxUploadAttempts: number;
  uploadRateLimit: number;
}

export interface FileUploadError {
  retryable?: boolean;
  retryAfter?: number;
  validationErrors?: Record<string, string[]>;
}

export interface FileUploadProgress {
  id: string;
  status: 'in_progress' | 'completed' | 'failed';
  progress: number;
  total: number;
  uploaded: number;
  startTime: number;
  lastUpdate: number;
  files: Record<string, FileProgress>;
}

export interface FileProgress {
  name: string;
  size: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  uploaded: number;
  path?: string;
}

export interface ProgressSubscription {
  progressId: string;
  onProgress: (progress: FileUploadProgress) => void;
  onError: (error: FileUploadError) => void;
  onComplete: (result: any) => void;
}

export interface MulterOptions {
  dest?: string;
  fileFilter?: (req: Request, file: File, cb: (error: Error | null, acceptFile: boolean) => void) => void;
  limits?: {
    fileSize?: number;
    files?: number;
  };
}

export interface MulterInstance {
  single(fieldname: string): (req: Request, res: Response, next: NextFunction) => void;
  array(fieldname: string, maxCount?: number): (req: Request, res: Response, next: NextFunction) => void;
  fields(fields: Array<{ name: string; maxCount: number }>): (req: Request, res: Response, next: NextFunction) => void;
  any(): (req: Request, res: Response, next: NextFunction) => void;
  none(): (req: Request, res: Response, next: NextFunction) => void;
}

export interface Multer {
  new (options?: MulterOptions): MulterInstance;
}

export interface FileUploadMiddleware {
  upload: Multer;
  validateUploadedFiles(req: Request, res: Response, next: (error?: Error | null) => void): Promise<void>;
  updateProgress(req: Request, file: MulterFile, progress: number): void;
  cleanupResources(): void;
  startPeriodicCleanup(): void;
  validateFileExtension(mimeType: string): boolean;
  validateFilename(filename: string): boolean;
  getInstance(): FileUploadMiddleware;
}
