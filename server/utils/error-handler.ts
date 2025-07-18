import { AppError, ErrorCategory, RetryableError } from '@shared/types/errors';
import { ImportExportErrorCode, ImportExportErrorCodes } from '@shared/types/import-export-errors';
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

export interface ErrorContext {
  operation: string;
  timestamp: number;
  userId?: number;
  requestId?: string;
  attempt?: number;
  metadata?: Record<string, unknown>;
}

export interface RetryOptions {
  maxAttempts: number;
  initialDelay: number; // in milliseconds
  maxDelay: number; // in milliseconds
  backoffFactor: number;
}

export interface ErrorHandlerConfig {
  retry: RetryOptions;
  cleanupTimeout: number; // in milliseconds
  maxErrorLogSize: number;
  maxRetryAttempts: number;
  initialRetryDelay: number;
  maxRetryDelay: number;
  backoffFactor: number;
}

export class ErrorHandler extends EventEmitter {
  private errorLog: Array<{ error: AppError; context: ErrorContext }> = [];
  private cleanupTimeout: NodeJS.Timeout | null = null;
  private config: ErrorHandlerConfig;

  constructor(config: ErrorHandlerConfig) {
    super();
    this.config = config;
  }

  private setupCleanup(): void {
    this.cleanupTimeout = setTimeout(() => {
      this.cleanupOldErrors();
      this.setupCleanup();
    }, this.config.cleanupTimeout);
  }

  private cleanupOldErrors(): void {
    const now = Date.now();
    this.errorLog = this.errorLog.filter(error => {
      const age = now - error.context.timestamp;
      return age < this.config.cleanupTimeout;
    });
  }

  private calculateDelay(attempt: number): number {
    const delay = this.config.retry.initialDelay * Math.pow(this.config.retry.backoffFactor, attempt - 1);
    return Math.min(delay, this.config.retry.maxDelay);
  }

  async withRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    options?: Partial<RetryOptions>
  ): Promise<T> {
    const retryConfig = { ...this.config.retry, ...options };
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        this.handleError(error, { ...context, attempt });

        if (attempt === retryConfig.maxAttempts) {
          throw error;
        }

        const delay = this.calculateDelay(attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    let errorObj: Error | null = null;
    if (lastError instanceof Error) {
      errorObj = lastError;
    } else if (typeof lastError === 'string') {
      errorObj = new Error(lastError);
    } else if (lastError && typeof lastError === 'object' && lastError !== null && 'message' in lastError && typeof (lastError as { message: unknown }).message === 'string') {
      errorObj = new Error(String((lastError as { message: string }).message));
    }

    if (!errorObj) {
      errorObj = new Error('Unknown error occurred');
    }

    throw errorObj;
  }

  private handleError(error: unknown, context: ErrorContext): void {
    const errorObj = error instanceof Error ? error : new Error('Unknown error occurred');
    
    // If we have an object with a message, use that
    if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
      errorObj.message = (error as { message: string }).message;
    }

    // Ensure we have a proper Error object
    const errorInstance: Error = errorObj instanceof Error ? errorObj : new Error(String((errorObj as { message: string } | null)?.message || 'Unknown error'));

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
      } else {
        this.emit('maxRetriesExceeded', enhancedError, context);
      }
    } else {
      this.emit('errorHandled', enhancedError, context);
    }
  }

  private enrichError(error: Error, context: ErrorContext): AppError {
    if (error instanceof AppError) {
      return error;
    }

    // Determine error code based on context
    let errorCode = "PROCESSING_ERROR";
    if (error.message.includes('format')) {
      errorCode = "INVALID_FILE_FORMAT";
    } else if (error.message.includes('size')) {
      errorCode = "FILE_TOO_LARGE";
    } else if (error.message.includes('validate')) {
      errorCode = "VALIDATION_ERROR";
    } else if (error.message.includes('timeout')) {
      errorCode = "TIMEOUT_ERROR";
    }

    const enhancedError = new AppError(
      error.message,
      ErrorCategory.SYSTEM,
      errorCode,
      {
        operation: context.operation,
        timestamp: context.timestamp,
        userId: context.userId,
        requestId: context.requestId,
        attempt: context.attempt,
        ...context.metadata
      },
      400,
      false,
      0
    );

    enhancedError.name = error.name;
    enhancedError.stack = error.stack;

    return enhancedError;
  }

  private logError(error: AppError, context: ErrorContext): void {
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

  async cleanup(): Promise<void> {
    if (this.cleanupTimeout) {
      clearTimeout(this.cleanupTimeout);
      this.cleanupTimeout = null;
    }

    // Clean up any resources
    this.errorLog = [];
    this.removeAllListeners();
  }

  getErrorHistory(): Array<{ error: Error; context: ErrorContext }> {
    return [...this.errorLog];
  }

  static createAppError(
    message: string,
    code: string,
    category: ErrorCategory,
    retryable: boolean = false,
    retryDelay: number = 0,
    context?: Record<string, unknown>
  ): AppError {
    return new AppError(
      message,
      category,
      code,
      context || {},
      400,
      retryable,
      retryDelay
    );
  }

  static isRetryable(error: Error): boolean {
    return error instanceof AppError && !!(error as AppError).retryable;
  }

  static getRetryDelay(error: Error): number {
    if (error instanceof AppError) {
      // Access the retryAfter property which exists on AppError
      return error.retryAfter || 0;
    }
    return 0;
  }
}
