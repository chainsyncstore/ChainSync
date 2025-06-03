import { Request, Response, NextFunction } from 'express';
// Removed: import { File } from 'multer'; // This causes an error. Use Express.Multer.File

export interface FileUploadConfig {
  maxFileSize: number;
  maxTotalUploadSize: number;
  allowedMimeTypes: string[];
  maxFiles: number;
  destination: string;
  filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => void;
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
  onComplete: (result: unknown) => void;
}

// Removed local MulterOptions, MulterInstance, Multer as these should come from the 'multer' package itself.
// Standard multer types (e.g., multer.Options, multer.Multer) should be used in implementations.

export interface FileUploadMiddleware {
  // The 'upload' property would typically be an instance of multer, i.e., multer.Multer
  // For typing, we can use the Multer interface from the 'multer' package if needed,
  // or more specifically, the result of calling multer(options).
  // For simplicity, if it's just storing the multer instance:
  upload: import('multer').Multer; // Use the actual Multer type from the library
  validateUploadedFiles(req: Request, res: Response, next: (error?: Error | null) => void): Promise<void>;
  updateProgress(req: Request, file: Express.Multer.File, progress: number): void; // Use Express.Multer.File
  cleanupResources(): void;
  startPeriodicCleanup(): void;
  validateFileExtension(mimeType: string): boolean;
  validateFilename(filename: string): boolean;
  getInstance(): FileUploadMiddleware;
}
