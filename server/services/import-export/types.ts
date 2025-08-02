import { AppError, ErrorCategory } from '@shared/types/errors';

// import { Express } from 'express'; // Unused

type MulterFile = File;

export interface IES {
  validateData(_data: any[], options?: ValidationOptions): Promise<ImportExportResult>;
  importData(_userId: number, _data: any[], _entityType: string, options?: ImportExportOptions): Promise<ImportExportResult>;
  exportData(_userId: number, _entityType: string, options?: ExportOptions): Promise<Buffer>;
  validateFile(_file: File): Promise<{ _type: string; _data: any[] }>;
  processImport(_data: any[], _options: ImportExportOptions, _importId: string): Promise<ImportExportResult>;
  processBatch(_data: any[], _importId: string): Promise<ImportExportResult>;
}

export interface ImportExportConfig {
  _batchSize: number;
}

export type ImportExportServiceErrors = {
  _INVALID_FILE_FORMAT: AppError;
  _FILE_TOO_LARGE: AppError;
  _INVALID_DATA: AppError;
  _PROCESSING_ERROR: AppError;
  _STORAGE_ERROR: AppError;
  _PROGRESS_ERROR: AppError;
};

export interface ImportExportProgress {
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  _message: string;
  _total: number;
  _processed: number;
  _errors: number;
}

export interface ValidationOptions {
  requiredFields?: string[];
  filters?: Record<string, any>;
}

export interface ImportExportResult {
  _success: boolean;
  _message: string;
  data?: any[];
  errors?: any[];
  _validCount: number;
  _invalidCount: number;
  _totalProcessed: number;
  _totalErrors: number;
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
  _format: string;
  _includeHeaders: boolean;
  delimiter?: string;
}
