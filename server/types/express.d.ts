import * as express from 'express';
import * as multer from 'multer';

export interface UserPayload {
  id: string;
  email: string;
  role: string;
  name: string; // Consistent name field
  username?: string; // Optional username if distinct from name
  storeId?: number; // Optional storeId
  [key: string]: any; // Add index signature for compatibility
}

declare module 'express' {
  interface Request {
    file?: multer.File;
    files?: {
      [fieldname: string]: multer.File[] | multer.File;
    };
    user?: UserPayload; // Use the standardized UserPayload
  }

  // RequestHandler and ErrorRequestHandler will use the augmented Request type by default
  // No need to redeclare them here if Request is correctly augmented.
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
