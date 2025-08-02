'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.RetryStrategy = void 0;
class RetryStrategy {
  constructor(maxRetries = 3, baseDelay = 1000, // 1 second
    maxDelay = 10000 // 10 seconds
  ) {
    this.maxRetries = maxRetries;
    this.baseDelay = baseDelay;
    this.maxDelay = maxDelay;
  }
  calculateDelay(attempt) {
    const delay = Math.min(this.baseDelay * Math.pow(2, attempt), this.maxDelay);
    return Math.floor(delay * (1 + Math.random() * 0.2)); // Add 0-20% jitter
  }
  async retry(operation, errorFilter = (error) => {
    const appError = error;
    return appError.retryable !== undefined;
  }, onRetry) {
    let attempt = 0;
    while (attempt < this.maxRetries) {
      try {
        return await operation();
      }
      catch (error) {
        if (!errorFilter(error)) {
          throw error;
        }
        if (attempt === this.maxRetries - 1) {
          throw error;
        }
        const delay = this.calculateDelay(attempt);
        if (onRetry) {
          onRetry(error, attempt);
        }
        await new Promise(resolve => setTimeout(resolve, delay));
        attempt++;
      }
    }
    throw new Error('Max retries exceeded');
  }
  static isRetryableError(error) {
    const appError = error;
    return appError.retryable !== undefined;
  }
  static getRetryAfter(error) {
    const appError = error;
    return appError.retryAfter;
  }
}
exports.RetryStrategy = RetryStrategy;
