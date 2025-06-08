import { RequestHandler } from 'express';
import { File } from 'multer';

// Extend Express types with our custom types
declare namespace Express {
  export interface Request extends express.Request {
    files?:
      | {
          [fieldname: string]: File | File[];
        }
      | File[];
    file?: File;
    user?: {
      id: string;
      email: string;
      role: string;
    };
  }

  export interface Response extends express.Response {}

  export interface NextFunction extends express.NextFunction {}
}

// Type for our Express app
export type App = express.Express & {
  use: (path: string, ...handlers: RequestHandler[]) => App;
  get: (path: string, ...handlers: RequestHandler[]) => App;
  post: (path: string, ...handlers: RequestHandler[]) => App;
  put: (path: string, ...handlers: RequestHandler[]) => App;
  delete: (path: string, ...handlers: RequestHandler[]) => App;
  patch: (path: string, ...handlers: RequestHandler[]) => App;
};

// Type for middleware functions
export type Middleware = RequestHandler;

// Type for route handlers
export type RouteHandler = RequestHandler;

// Type for error handler
export type ErrorHandler = (
  err: Error,
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => void;
