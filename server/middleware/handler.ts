import { Request, Response, NextFunction, RequestHandler, ErrorRequestHandler } from 'express';

// Wraps a handler to allow for consistent error handling (pass-through for now)
export function createRequestHandler(fn: RequestHandler): RequestHandler {
  return function (req, res, next) {
    try {
      return fn(req, res, next);
    } catch (err) {
      next(err);
    }
  };
}

export function createErrorHandler(fn: ErrorRequestHandler): ErrorRequestHandler {
  return function (err, req, res, next) {
    try {
      return fn(err, req, res, next);
    } catch (e) {
      next(e);
    }
  };
}

export function isMiddlewareFunction(fn: unknown): fn is RequestHandler | ErrorRequestHandler {
  return typeof fn === 'function';
}
