import { RequestHandler, ErrorRequestHandler } from 'express';

export interface IMiddleware {
  [key: string]: RequestHandler | ErrorRequestHandler | ((...args: any[]) => RequestHandler);
}

export interface AuthMiddleware extends IMiddleware {
  isAuthenticated: RequestHandler;
  isAdmin: RequestHandler;
  isManagerOrAdmin: RequestHandler;
  hasStoreAccess: (storeIdParam?: string) => RequestHandler;
}

export interface ErrorHandler extends IMiddleware {
  errorHandler: ErrorRequestHandler;
}

export interface RateLimiter extends IMiddleware {
  applyRateLimiters: RequestHandler;
}

export interface FileUploadMiddleware extends IMiddleware {
  handleUpload: RequestHandler;
  getProgress: RequestHandler;
  subscribeToProgress: RequestHandler;
}
