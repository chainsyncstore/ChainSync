'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.AppError = void 0;
class AppError extends Error {
  constructor(category, code, message, details, statusCode) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.category = category;
    this.details = details;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AppError.prototype);
  }
  static create(category, code, message, details, statusCode) {
    return new AppError(category, code, message, details, statusCode);
  }
}
exports.AppError = AppError;
