import { Request, Response, NextFunction } from 'express';

declare module 'multer' {
  interface File {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    destination: string;
    filename: string;
    path: string;
    size: number;
    buffer?: Buffer;
  }

  type MulterError = {
    code: string;
    field: string;
    storageErrors?: string[];
  } & Error;

  type MulterOptions = {
    dest?: string;
    fileFilter?: (req: Request, file: File, cb: (error: Error | null, acceptFile: boolean) => void) => void;
    limits?: {
      fileSize?: number;
      files?: number;
    };
    storage?: StorageEngine;
  };
}

export interface StorageEngine {
  _handleFile(req: Request, file: File, cb: (error: Error | null, info: any) => void): void;
  _removeFile(req: Request, file: File, cb: (error: Error | null) => void): void;
}

export class Multer {
  constructor(options?: Options);
  single(fieldname: string): (req: Request, res: Response, next: NextFunction) => void;
  array(fieldname: string, maxCount?: number): (req: Request, res: Response, next: NextFunction) => void;
  fields(fields: Array<{
    name: string;
    maxCount?: number;
  }>): (req: Request, res: Response, next: NextFunction) => void;
  none(): (req: Request, res: Response, next: NextFunction) => void;
  any(): (req: Request, res: Response, next: NextFunction) => void;
  memory(): (req: Request, res: Response, next: NextFunction) => void;
}

export default Multer;
