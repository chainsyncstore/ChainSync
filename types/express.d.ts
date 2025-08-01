import { User } from '../shared/schema';
import { File } from 'multer';

// Extend Express types using module augmentation
declare module 'express-serve-static-core' {
  interface Request {
    user?: User;
    file?: File;
    files?: {
      [fieldname: string]: File[] | File;
    };
  }
}
