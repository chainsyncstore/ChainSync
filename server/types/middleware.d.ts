import { RequestHandler, ErrorRequestHandler, Request, Response, NextFunction } from 'express';
import { File } from 'express';

// Define our custom user type
interface CustomUser {
  id: string;
  email: string;
  role: string;
  [key: string]: unknown;
}

// Extend Express Request type to handle file uploads and user type
declare module 'express' {
  interface Request {
    file?: File;
    files?: {
      [fieldname: string]: File[] | File;
    };
    user?: Partial<CustomUser>;
  }
}

// Helper function to create request handler
export function createRequestHandler(handler: (req: Request, res: Response, next: NextFunction) => void): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res, next);
  };
}

// Helper function to create error handler
export function createErrorHandler(handler: (err: Error | unknown, req: Request, res: Response, next: NextFunction) => void): ErrorRequestHandler {
  return (err: Error | unknown, req: Request, res: Response, next: NextFunction): void => {
    handler(err, req, res, next);
  };
}

// Type guard for middleware
export function isMiddlewareFunction(middleware: unknown): middleware is RequestHandler | ErrorRequestHandler {
  return typeof middleware === 'function' && 
    (middleware.length === 3 || middleware.length === 4);
}
