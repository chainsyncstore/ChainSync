import * as express from 'express';
import * as multer from 'multer';

declare module 'express' {
  interface Request {
    file?: multer.File;
    files?: {
      [fieldname: string]: multer.File[] | multer.File;
    };
    user?: {
      id: string;
      email: string;
      role: string;
      [key: string]: unknown;
    };
  }

  interface RequestHandler {
    (req: Request, res: Response, next: NextFunction): void;
  }

  interface ErrorRequestHandler {
    (err: unknown, req: Request, res: Response, next: NextFunction): void;
  }
}

declare global {
  namespace Express {
    interface Multer {
      File: multer.File;
      memoryStorage: () => multer.StorageEngine;
      diskStorage: (config: multer.DiskStorageOptions) => multer.StorageEngine;
    }
  }
}
