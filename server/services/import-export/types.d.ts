declare module 'csv-parser' {
  export default function(): unknown;
}

declare module 'json2csv' {
  export default function(): unknown;
}

import { Request, Response, NextFunction } from 'express';
// Removed: import * as multer from 'multer'; 
// Removed: import { MulterFile } from '../types/multer';
// Removed: import type { File as MulterFileOriginal } from 'multer';
// Removed: import type { File as MulterDotFile } from 'multer';

// Extend Express types - This should be handled globally by server/types/express.d.ts
// declare global {
//   namespace Express {
//     interface Request {
//       file?: MulterFileOriginal; // Changed to MulterFileOriginal
//       files?: MulterFileOriginal[]; // Changed to MulterFileOriginal
//     }
//   }
// }

// Augmenting 'multer' module locally is problematic and likely conflicts.
// Standard @types/multer should provide these.
// declare module 'multer' {
//   ... (removed content) ...
// }

// Extend Express Request type with Multer - This should be handled globally
// import { Buffer } from 'buffer'; // Buffer is global

// declare global {
//   namespace Express {
//     // This MulterFile definition is redundant if using original multer.File
//     // interface MulterFile {
//     //   fieldname: string;
//     //   originalname: string;
//     //   encoding: string;
//     //   mimetype: string;
//     //   size: number;
//     //   destination: string;
//     //   filename: string;
//     //   path: string;
//     //   buffer?: Buffer;
//     // }

//     interface Request {
//       file?: MulterFileOriginal; // Changed to MulterFileOriginal
//       files?: MulterFileOriginal[]; // Changed to MulterFileOriginal
//     }
//   }
// }

// Use multer.File directly or alias it if needed for clarity
// This local 'File' interface is redundant as MulterDotFile (multer.File) should be used directly.
// export interface File extends MulterDotFile {
// }

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
  importProducts(userId: number, file: Express.Multer.File, options?: ValidationOptions): Promise<ImportExportResult>;
  getImportProgress(importId: string): Promise<ImportExportProgress>;
  cancelImport(importId: string): Promise<void>;
  clearImport(importId: string): Promise<void>;
  validateData(data: unknown[], type: 'products' | 'users' | 'transactions', options?: ValidationOptions): Promise<{ valid: unknown[]; invalid: { index: number; errors: string[] }[] }>;
  exportProducts(userId: number, options?: { format?: 'csv' | 'xlsx' | 'json' }): Promise<Buffer>;
}
