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
  validateData(data: Record<string, unknown>[], options?: ValidationOptions): Promise<ImportExportResult>;
  importData(userId: number, data: Record<string, unknown>[], entityType: string, options?: ImportExportOptions): Promise<ImportExportResult>;
  exportData(userId: number, entityType: string, options?: ExportOptions): Promise<Buffer>;
  validateFile(file: File): Promise<{ type: string; data: Record<string, unknown>[] }>;
  processImport(data: Record<string, unknown>[], options: ImportExportOptions, importId: string): Promise<ImportExportResult>;
  processBatch(data: Record<string, unknown>[], importId: string): Promise<ImportExportResult>;
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
  filters?: Record<string, unknown>;
}

export interface ImportExportResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>[];
  errors?: Record<string, unknown>[];
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
  filters?: Record<string, unknown>;
}

export interface ExportOptions {
  format: string;
  includeHeaders: boolean;
  delimiter?: string;
}
