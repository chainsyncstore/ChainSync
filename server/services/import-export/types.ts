import { ImportExportConfig } from '../../config/import-export';
import { ErrorCategory, ErrorCode } from '@shared/types/errors';
import { Request } from 'express';
import { MulterFile } from '../../types/multer';

// Type definitions
export type File = MulterFile;

// Extend Express types
declare global {
  namespace Express {
    interface Request {
      file?: MulterFile;
      files?: MulterFile[];
    }
  }
}

export interface ImportExportResult {
  success: boolean;
  message?: string;
  data?: any;
  errors?: any[];
  validCount?: number;
  invalidCount?: number;
  totalProcessed?: number;
  totalErrors: number;
}

export interface ImportExportProgress {
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  message: string;
  total: number;
  processed: number;
  errors: number;
}

export interface ValidationOptions {
  batchSize?: number;
  validateOnly?: boolean;
  filters?: any;
}

export interface ImportExportServiceErrors {
  INVALID_FILE: string;
  PROCESSING_ERROR: string;
  INVALID_FORMAT: string;
  EXPORT_ERROR: string;
  DATABASE_ERROR: string;
}

export interface ImportExportService {
  // Import Methods
  importProducts(
    userId: number,
    file: Express.MulterFile,
    options?: {
      validateOnly?: boolean;
      batchSize?: number;
    }
  ): Promise<ImportExportResult>;

  importUsers(
    userId: number,
    file: Express.Multer.File,
    options?: {
      validateOnly?: boolean;
      batchSize?: number;
    }
  ): Promise<ImportExportResult>;

  importTransactions(
    userId: number,
    file: Express.Multer.File,
    options?: {
      validateOnly?: boolean;
      batchSize?: number;
    }
  ): Promise<ImportExportResult>;

  // Export Methods
  exportProducts(
    userId: number,
    options?: {
      includeInactive?: boolean;
      format?: 'csv' | 'excel';
    }
  ): Promise<Buffer>;

  exportUsers(
    userId: number,
    options?: {
      format?: 'csv' | 'xlsx' | 'json';
      filters?: any;
    }
  ): Promise<Buffer>;

  exportTransactions(
    userId: number,
    options?: {
      format?: 'csv' | 'xlsx' | 'json';
      filters?: any;
    }
  ): Promise<Buffer>;

  // Progress Tracking
  getImportProgress(
    importId: string
  ): Promise<ImportExportProgress>;

  getExportProgress(
    exportId: string
  ): Promise<ImportExportProgress>;

  // Validation
  validateFile(
    file: Express.Multer.File
  ): Promise<void>;

  validateData(
    data: any[],
    type: 'products' | 'users' | 'transactions',
    options?: ValidationOptions
  ): Promise<{ valid: any[]; invalid: { index: number; errors: string[]; }[] }>;
}
