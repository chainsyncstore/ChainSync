// Simplified multer type definitions to avoid conflicts with @types/multer

import { Request, Response, NextFunction } from 'express';

// We need to avoid extending the Express namespace to prevent conflicts
// Instead, we'll define the multer module with compatible interfaces

declare module 'multer' {
  function multer(options?: unknown): unknown;
  
  namespace multer {
    function single(fieldname: string): (req: Request, res: Response, next: NextFunction) => void;
    function array(fieldname: string, maxCount?: number): (req: Request, res: Response, next: NextFunction) => void;
    function fields(fields: Array<{ name: string; maxCount?: number }>): (req: Request, res: Response, next: NextFunction) => void;
    function any(): (req: Request, res: Response, next: NextFunction) => void;
    function none(): (req: Request, res: Response, next: NextFunction) => void;
    function diskStorage(options: {
      destination?: string | ((req: Request, file: unknown, cb: (error: Error | null, destination: string) => void) => void);
      filename?: (req: Request, file: unknown, cb: (error: Error | null, filename: string) => void) => void;
    }): unknown;
    function memoryStorage(): unknown;
  }
}
