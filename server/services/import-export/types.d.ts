declare module 'csv-parser' {
  export default function(): any;
}

declare module 'json2csv' {
  export default function(): any;
}

import { Request, Response, NextFunction } from 'express';
import { MulterFile } from '../types/multer';

// Extend Express types
declare global {
  namespace Express {
    interface Request {
      file?: MulterFile;
      files?: MulterFile[];
    }
  }
}

declare module 'multer' {
  export interface Multer {
    any(): (req: Request, res: Response, next: NextFunction) => void;
    single(fieldname: string): (req: Request, res: Response, next: NextFunction) => void;
    array(fieldname: string, maxCount?: number): (req: Request, res: Response, next: NextFunction) => void;
    fields(fields: Array<{
      name: string;
      maxCount?: number;
    }>): (req: Request, res: Response, next: NextFunction) => void;
    none(): (req: Request, res: Response, next: NextFunction) => void;
    memory(): (req: Request, res: Response, next: NextFunction) => void;
  }

  export type File = MulterFile;

  export interface StorageEngine {
    _handleFile(req: Request, file: MulterFile, cb: (error: Error | null, info: any) => void): void;
    _removeFile(req: Request, file: MulterFile, cb: (error: Error | null) => void): void;
  }

  export interface Options {
    dest?: string;
    fileFilter?: (req: Request, file: MulterFile, callback: (error: Error | null, acceptFile: boolean) => void) => void;
    limits?: {
      fileSize?: number;
      files?: number;
    };
    storage?: StorageEngine;
  }

  export const diskStorage: (options: {
    destination?: string | ((req: Request, file: MulterFile, callback: (error: Error | null, destination: string) => void) => void);
    filename?: (req: Request, file: MulterFile, callback: (error: Error | null, filename: string) => void) => void;
  }) => any;

  export const memoryStorage: () => any;

  export default function(options?: Options): Multer;
}

// Extend Express Request type with Multer
import { Buffer } from 'buffer';

declare global {
  namespace Express {
    interface MulterFile {
      fieldname: string;
      originalname: string;
      encoding: string;
      mimetype: string;
      size: number;
      destination: string;
      filename: string;
      path: string;
      buffer?: Buffer;
    }

    interface Request {
      file?: MulterFile;
      files?: MulterFile[];
    }
  }
}

export interface File extends Express.MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer?: Buffer;
}

export interface ImportExportResult {
  success: boolean;
  totalProcessed: number;
  totalErrors: number;
  errors: string[];
  validCount: number;
  invalidCount: number;
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
}

export interface ImportExportService {
  importProducts(userId: number, file: Express.MulterFile, options?: ValidationOptions): Promise<ImportExportResult>;
  getImportProgress(importId: string): Promise<ImportExportProgress>;
  cancelImport(importId: string): Promise<void>;
  clearImport(importId: string): Promise<void>;
  validateData(data: any[], type: 'products' | 'users' | 'transactions', options?: ValidationOptions): Promise<{ valid: any[]; invalid: { index: number; errors: string[] }[] }>;
  exportProducts(userId: number, options?: { format?: 'csv' | 'xlsx' | 'json' }): Promise<Buffer>;
}
