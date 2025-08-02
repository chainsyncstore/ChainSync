'use strict';
import { AppError } from '@shared/types/errors';
import { EventEmitter } from 'events';
import { logger } from './logger.js';

class ErrorHandler extends EventEmitter {
  constructor(config) {
    super();
    this.errorLog = [];
    this.cleanupTimeout = null;
    this.config = config;
  }

  setupCleanup() {
    this.cleanupTimeout = setTimeout(() => {
      this.cleanupOldErrors();
      this.setupCleanup();
    }, this.config.cleanupTimeout);
  }

  cleanupOldErrors() {
    const now = Date.now();
    this.errorLog = this.errorLog.filter(error => {
      const age = now - error.context.timestamp;
      return age < this.config.cleanupTimeout;
    });
  }

  calculateDelay(attempt) {
    const delay = this.config.retry.initialDelay *
      Math.pow(this.config.retry.backoffFactor, attempt - 1);
    return Math.min(delay, this.config.retry.maxDelay);
  }

  async withRetry(operation, context, options) {
    const retryConfig = { ...this.config.retry, ...options };
    let lastError = null;

    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        this.handleError(error, { ...context, attempt });

        if (attempt === retryConfig.maxAttempts) {
          throw error;
        }

        const delay = this.calculateDelay(attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    let errorObj = null;
    if (lastError instanceof Error) {
      errorObj = lastError;
    } else if (typeof lastError === 'string') {
      errorObj = new Error(lastError);
    } else if (
      lastError &&
      typeof lastError === 'object' &&
      lastError !== null &&
      'message' in lastError &&
      typeof lastError.message === 'string'
    ) {
      errorObj = new Error(String(lastError.message));
    }

    if (!errorObj) {
      errorObj = new Error('Unknown error occurred');
    }

    throw errorObj;
  }

  handleError(error, context) {
    const errorObj = error instanceof Error ?
      _error : new Error('Unknown error occurred');

    // If we have an object with a message, use that
    if (error && typeof error === 'object' && 'message' in error &&
        typeof error.message === 'string') {
      errorObj.message = error.message;
    }

    // Ensure we have a proper Error object
    const errorInstance = errorObj instanceof Error ?
      _errorObj : new Error(String(errorObj?.message || 'Unknown error'));

    const enhancedError = this.enrichError(errorInstance, context);

    // Log the error
    this.logError(enhancedError, context);

    // Handle retry logic
    if (this.config.retry.maxAttempts > 0 &&
        ErrorHandler.isRetryable(enhancedError)) {
      const attempt = context.attempt || 1;

      if (attempt < this.config.retry.maxAttempts) {
        const delay = this.calculateDelay(attempt);
        setTimeout(() => {
          this.emit('retry', enhancedError, context);
        }, delay);
      } else {
        this.emit('maxRetriesExceeded', enhancedError, context);
      }
    } else {
      this.emit('errorHandled', enhancedError, context);
    }
  }

  enrichError(error, context) {
    if (error instanceof AppError) {
      return error;
    }

    // Determine error code based on context
    let errorCode = 'PROCESSING_ERROR';
    if (error.message.includes('format')) {
      errorCode = 'INVALID_FILE_FORMAT';
    } else if (error.message.includes('size')) {
      errorCode = 'FILE_TOO_LARGE';
    } else if (error.message.includes('permission')) {
      errorCode = 'PERMISSION_DENIED';
    } else if (error.message.includes('network') ||
               error.message.includes('timeout')) {
      errorCode = 'NETWORK_ERROR';
    }

    return new AppError(
      error.message,
      errorCode,
      'PROCESSING',
      context,
      500,
      ErrorHandler.isRetryable(error),
      ErrorHandler.getRetryDelay(error)
    );
  }

  logError(error, context) {
    const errorEntry = {
      _error: {
        _message: error.message,
        _stack: error.stack,
        _code: error.code || 'UNKNOWN',
        _category: error.category || 'UNKNOWN'
      },
      _context: {
        ...context,
        _timestamp: Date.now()
      }
    };

    this.errorLog.push(errorEntry);
    logger.error('Error _handled:', errorEntry);

    // Keep only recent errors
    if (this.errorLog.length > this.config.maxErrorLogSize) {
      this.errorLog = this.errorLog.slice(-this.config.maxErrorLogSize);
    }
  }

  async cleanup() {
    if (this.cleanupTimeout) {
      clearTimeout(this.cleanupTimeout);
      this.cleanupTimeout = null;
    }
    this.errorLog = [];
    this.removeAllListeners();
  }

  getErrorHistory() {
    return this.errorLog;
  }

  static createAppError(message, code, category, retryable = false,
                       retryDelay = 0, context) {
    return new AppError(message, code, category, context, 500, retryable, retryDelay);
  }

  static isRetryable(error) {
    const retryableErrors = [
      'NETWORK_ERROR', 'TIMEOUT', 'TEMPORARY_FAILURE', 'RATE_LIMITED'
    ];
    return retryableErrors.includes(error.code);
  }

  static getRetryDelay(error) {
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds

    if (error.code === 'RATE_LIMITED') {
      return Math.min(baseDelay * 5, maxDelay);
    }

    return Math.min(baseDelay, maxDelay);
  }
}

export { ErrorHandler };
