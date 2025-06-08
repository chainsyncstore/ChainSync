import { AppError, ErrorCategory } from '@shared/types/errors';
import { Express } from 'express';

// Use Express types instead of custom File interface
declare global {
  namespace Express {
    interface Request {
      file?: Express.Multer.File;
      files?: { [fieldname: string]: Express.Multer.File[] } | Express.Multer.File[];
    }
  }
}

export interface IES {
  validateData(data: unknown[], options?: ValidationOptions): Promise<ImportExportResult>;
  importData(
    userId: number,
    data: unknown[],
    entityType: string,
    options?: ImportExportOptions
  ): Promise<ImportExportResult>;
  exportData(userId: number, entityType: string, options?: ExportOptions): Promise<Buffer>;
  validateFile(file: File): Promise<{ type: string; data: unknown[] }>;
  processImport(
    data: unknown[],
    options: ImportExportOptions,
    importId: string
  ): Promise<ImportExportResult>;
  processBatch(data: unknown[], importId: string): Promise<ImportExportResult>;
}

export interface ImportExportConfig {
  batchSize: number;
}

export type ImportExportServiceErrors = {
  INVALID_FILE_FORMAT: AppError;
  FILE_TOO_LARGE: AppError;
  INVALID_DATA: AppError;
  PROCESSING_ERROR: AppError;
  STORAGE_ERROR: AppError;
  PROGRESS_ERROR: AppError;
};

export interface ImportExportProgress {
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  message: string;
  total: number;
  processed: number;
  errors: number;
}

export interface ValidationOptions {
  requiredFields?: string[];
  filters?: Record<string, any>;
}

export interface ImportExportResult {
  success: boolean;
  message: string;
  data?: unknown[];
  errors?: unknown[];
  validCount: number;
  invalidCount: number;
  totalProcessed: number;
  totalErrors: number;
  importId?: string;
}

export interface ImportExportOptions {
  batchSize?: number;
  delimiter?: string;
  includeHeaders?: boolean;
  format?: string;
  filters?: Record<string, any>;
}

export interface ExportOptions {
  format: string;
  includeHeaders: boolean;
  delimiter?: string;
}
