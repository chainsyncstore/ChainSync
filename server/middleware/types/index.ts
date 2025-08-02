import { RequestHandler, ErrorRequestHandler } from 'express';

export interface IMiddleware {
  [_key: string]: RequestHandler | ErrorRequestHandler | ((..._args: any[]) => RequestHandler);
}

export interface AuthMiddleware extends IMiddleware {
  _isAuthenticated: RequestHandler;
  _isAdmin: RequestHandler;
  _isManagerOrAdmin: RequestHandler;
  hasStoreAccess: (storeIdParam?: string) => RequestHandler;
}

export interface ErrorHandler extends IMiddleware {
  _errorHandler: ErrorRequestHandler;
}

export interface RateLimiter extends IMiddleware {
  _applyRateLimiters: RequestHandler;
}

export interface FileUploadMiddleware extends IMiddleware {
  _handleUpload: RequestHandler;
  _getProgress: RequestHandler;
  _subscribeToProgress: RequestHandler;
}
