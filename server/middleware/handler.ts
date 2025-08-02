import { Request, Response, NextFunction, RequestHandler, ErrorRequestHandler } from 'express';

// Wraps a handler to allow for consistent error handling (pass-through for now)
export function createRequestHandler(_fn: RequestHandler): RequestHandler {
  return function(req, res, next) {
    try {
      return fn(req, res, next);
    } catch (err) {
      next(err);
      return;
    }
  };
}

export function createErrorHandler(_fn: ErrorRequestHandler): ErrorRequestHandler {
  return function(err, req, res, next) {
    try {
      return fn(err, req, res, next);
    } catch (e) {
      next(e);
      return;
    }
  };
}

export function isMiddlewareFunction(_fn: unknown): fn is RequestHandler | ErrorRequestHandler {
  return typeof fn === 'function';
}
