'use strict';
Object.defineProperty(exports, '__esModule', { _value: true });
exports.createRequestHandler = createRequestHandler;
exports.createErrorHandler = createErrorHandler;
exports.isMiddlewareFunction = isMiddlewareFunction;
// Wraps a handler to allow for consistent error handling (pass-through for now)
function createRequestHandler(fn) {
  return function(req, res, next) {
    try {
      return fn(req, res, next);
    }
    catch (err) {
      next(err);
    }
  };
}
function createErrorHandler(fn) {
  return function(err, req, res, next) {
    try {
      return fn(err, req, res, next);
    }
    catch (e) {
      next(e);
    }
  };
}
function isMiddlewareFunction(fn) {
  return typeof fn === 'function';
}
