"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorHandler = void 0;
const errors_1 = require("@shared/types/errors");
const events_1 = require("events");
class ErrorHandler extends events_1.EventEmitter {
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
        const delay = this.config.retry.initialDelay * Math.pow(this.config.retry.backoffFactor, attempt - 1);
        return Math.min(delay, this.config.retry.maxDelay);
    }
    async withRetry(operation, context, options) {
        const retryConfig = { ...this.config.retry, ...options };
        let lastError = null;
        for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
            try {
                return await operation();
            }
            catch (error) {
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
        }
        else if (typeof lastError === 'string') {
            errorObj = new Error(lastError);
        }
        else if (lastError && typeof lastError === 'object' && lastError !== null && 'message' in lastError && typeof lastError.message === 'string') {
            errorObj = new Error(String(lastError.message));
        }
        if (!errorObj) {
            errorObj = new Error('Unknown error occurred');
        }
        throw errorObj;
    }
    handleError(error, context) {
        const errorObj = error instanceof Error ? error : new Error('Unknown error occurred');
        // If we have an object with a message, use that
        if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
            errorObj.message = error.message;
        }
        // Ensure we have a proper Error object
        const errorInstance = errorObj instanceof Error ? errorObj : new Error(String(errorObj?.message || 'Unknown error'));
        const enhancedError = this.enrichError(errorInstance, context);
        // Log the error
        this.logError(enhancedError, context);
        // Handle retry logic
        if (this.config.retry.maxAttempts > 0 && ErrorHandler.isRetryable(enhancedError)) {
            const attempt = context.attempt || 1;
            if (attempt < this.config.retry.maxAttempts) {
                const delay = this.calculateDelay(attempt);
                setTimeout(() => {
                    this.emit('retry', enhancedError, context);
                }, delay);
            }
            else {
                this.emit('maxRetriesExceeded', enhancedError, context);
            }
        }
        else {
            this.emit('errorHandled', enhancedError, context);
        }
    }
    enrichError(error, context) {
        if (error instanceof errors_1.AppError) {
            return error;
        }
        // Determine error code based on context
        let errorCode = "PROCESSING_ERROR";
        if (error.message.includes('format')) {
            errorCode = "INVALID_FILE_FORMAT";
        }
        else if (error.message.includes('size')) {
            errorCode = "FILE_TOO_LARGE";
        }
        else if (error.message.includes('validate')) {
            errorCode = "VALIDATION_ERROR";
        }
        else if (error.message.includes('timeout')) {
            errorCode = "TIMEOUT_ERROR";
        }
        const enhancedError = new errors_1.AppError(error.message, errors_1.ErrorCategory.SYSTEM, errorCode, {
            operation: context.operation,
            timestamp: context.timestamp,
            userId: context.userId,
            requestId: context.requestId,
            attempt: context.attempt,
            ...context.metadata
        }, 400, false, 0);
        enhancedError.name = error.name;
        enhancedError.stack = error.stack;
        return enhancedError;
    }
    logError(error, context) {
        // Add error to log with context
        this.errorLog.push({ error, context });
        // Remove oldest error if we exceed max size
        if (this.errorLog.length > this.config.maxErrorLogSize) {
            this.errorLog.shift();
        }
        // Log to console for debugging
        console.error('Error occurred:', {
            message: error.message,
            operation: context.operation,
            timestamp: context.timestamp,
            metadata: context.metadata
        });
    }
    async cleanup() {
        if (this.cleanupTimeout) {
            clearTimeout(this.cleanupTimeout);
            this.cleanupTimeout = null;
        }
        // Clean up any resources
        this.errorLog = [];
        this.removeAllListeners();
    }
    getErrorHistory() {
        return [...this.errorLog];
    }
    static createAppError(message, code, category, retryable = false, retryDelay = 0, context) {
        return new errors_1.AppError(message, category, code, context || {}, 400, retryable, retryDelay);
    }
    static isRetryable(error) {
        return error instanceof errors_1.AppError && !!error.retryable;
    }
    static getRetryDelay(error) {
        if (error instanceof errors_1.AppError) {
            // Access the retryAfter property which exists on AppError
            return error.retryAfter || 0;
        }
        return 0;
    }
}
exports.ErrorHandler = ErrorHandler;
