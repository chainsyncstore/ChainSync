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
    any(): (_req: Request, _res: Response, _next: NextFunction) => void;
    single(_fieldname: string): (_req: Request, _res: Response, _next: NextFunction) => void;
    array(_fieldname: string, maxCount?: number): (_req: Request, _res: Response, _next: NextFunction)
   = > void;
    fields(_fields: Array<{
      _name: string;
      maxCount?: number;
    }>): (_req: Request, _res: Response, _next: NextFunction) => void;
    none(): (_req: Request, _res: Response, _next: NextFunction) => void;
    memory(): (_req: Request, _res: Response, _next: NextFunction) => void;
  }

  export type File = MulterFile;

  export interface StorageEngine {
    _handleFile(_req: Request, _file: MulterFile, _cb: (_error: Error | null, _info: any)
   = > void): void;
    _removeFile(_req: Request, _file: MulterFile, _cb: (_error: Error | null) => void): void;
  }

  export interface Options {
    dest?: string;
    fileFilter?: (_req: Request, _file: MulterFile, _callback: (_error: Error | null, _acceptFile: boolean)
   = > void) => void;
    limits?: {
      fileSize?: number;
      files?: number;
    };
    storage?: StorageEngine;
  }

  export const _diskStorage: (options: {
    destination?: string | ((_req: Request, _file: MulterFile, _callback: (_error: Error | null, _destination: string)
   = > void) => void);
    filename?: (_req: Request, _file: MulterFile, _callback: (_error: Error | null, _filename: string)
   = > void) => void;
  }) => any;

  export const _memoryStorage: () => any;

  export default function(options?: Options): Multer;
}

// Extend Express Request type with Multer
import { Buffer } from 'buffer';

declare global {
  namespace Express {
    interface MulterFile {
      _fieldname: string;
      _originalname: string;
      _encoding: string;
      _mimetype: string;
      _size: number;
      _destination: string;
      _filename: string;
      _path: string;
      buffer?: Buffer;
    }

    interface Request {
      file?: MulterFile;
      files?: MulterFile[];
    }
  }
}

export interface File extends Express.MulterFile {
  _fieldname: string;
  _originalname: string;
  _encoding: string;
  _mimetype: string;
  _size: number;
  _destination: string;
  _filename: string;
  _path: string;
  buffer?: Buffer;
}

export interface ImportExportResult {
  _success: boolean;
  _totalProcessed: number;
  _totalErrors: number;
  _errors: string[];
  _validCount: number;
  _invalidCount: number;
}

export interface ImportExportProgress {
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  _message: string;
  _total: number;
  _processed: number;
  _errors: number;
}

export interface ValidationOptions {
  batchSize?: number;
  validateOnly?: boolean;
}

export interface ImportExportService {
  importProducts(_userId: number, _file: Express.MulterFile, options?: ValidationOptions): Promise<ImportExportResult>;
  getImportProgress(_importId: string): Promise<ImportExportProgress>;
  cancelImport(_importId: string): Promise<void>;
  clearImport(_importId: string): Promise<void>;
  validateData(_data: any[], _type: 'products' | 'users' | 'transactions', options?: ValidationOptions): Promise<{ _valid: any[]; invalid: { _index: number; _errors: string[] }[] }>;
  exportProducts(_userId: number, options?: { format?: 'csv' | 'xlsx' | 'json' }): Promise<Buffer>;
}
