import * as express from 'express';
import * as multer from 'multer';
import { UserPayload } from '../types/user'; // Import UserPayload from the central location

// Remove the local UserPayload definition, as it's now imported

declare module 'express' {
    interface Request {
      file?: multer.File;
      files?: {
        [fieldname: string]: multer.File[] | multer.File;
      };
      user?: UserPayload; // Use the imported UserPayload
      progressId?: string; // Added from middleware types
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
