'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.BaseService = exports.ServiceError = void 0;
const errors_1 = require('@shared/types/errors');
class ServiceError extends Error {
  constructor(message, code, category, retryable = false, retryAfter, details) {
    super(message);
    this.code = code;
    this.category = category;
    this.retryable = retryable;
    this.retryAfter = retryAfter;
    this.details = details;
    this.name = 'ServiceError';
  }
}
exports.ServiceError = ServiceError;
class BaseService {
  handleError(error, context) {
    const serviceError = this.convertToServiceError(error);
    /* eslint-disable no-console */
    console.error(`[${this.constructor.name}] ${context} failed:`, serviceError);
    /* eslint-enable */
    throw serviceError;
  }
  convertToServiceError(error) {
    if (error instanceof ServiceError)
      return error;
    const msg = error && typeof error === 'object' && 'message' in error
      ? String(error.message)
      : 'Unknown error';
    return new ServiceError(msg, errors_1.ErrorCode.INTERNAL_SERVER_ERROR, errors_1.ErrorCategory.SYSTEM, false, undefined, { originalError: error });
  }
  /* Simple wrappers ---------------------------------------------------- */
  async withTransaction(operation, context) {
    try {
      return await operation();
    }
    catch (err) {
      this.handleError(err, context); // never returns
    }
  }
  async withRetry(operation, context, maxRetries = 3, baseDelay = 1000) {
    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
      try {
        return await operation();
      }
      catch (err) {
        const e = this.convertToServiceError(err);
        if (!e.retryable || attempt === maxRetries - 1)
          throw e;
        await new Promise((r) => setTimeout(r, baseDelay * 2 ** attempt));
      }
    }
    /* istanbul ignore next */
    throw new ServiceError('Max retries exceeded', errors_1.ErrorCode.TEMPORARY_UNAVAILABLE, errors_1.ErrorCategory.SYSTEM, true);
  }
}
exports.BaseService = BaseService;
