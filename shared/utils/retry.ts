import { AppError, RetryableError } from '../types/errors.js';

export class RetryStrategy {
  private readonly maxRetries: number;
  private readonly baseDelay: number;
  private readonly maxDelay: number;

  constructor(
    maxRetries: number = 3,
    baseDelay: number = 1000, // 1 second
    maxDelay: number = 10000 // 10 seconds
  ) {
    this.maxRetries = maxRetries;
    this.baseDelay = baseDelay;
    this.maxDelay = maxDelay;
  }

  private calculateDelay(attempt: number): number {
    const delay = Math.min(this.baseDelay * Math.pow(2, attempt), this.maxDelay);
    return Math.floor(delay * (1 + Math.random() * 0.2)); // Add 0-20% jitter
  }

  public async retry<T>(
    operation: () => Promise<T>,
    errorFilter: (error: Error) => boolean = err => {
      // Renamed parameter for clarity
      return err instanceof AppError && err.retryable !== undefined;
    },
    onRetry?: (error: Error, attempt: number) => void
  ): Promise<T> {
    let attempt = 0;

    while (attempt < this.maxRetries) {
      try {
        return await operation();
      } catch (error: unknown) {
        const errorInstance = error instanceof Error ? error : new Error(String(error));

        if (!errorFilter(errorInstance)) {
          // Re-throw the original error if it's an AppError, otherwise wrap it.
          throw error instanceof AppError
            ? error
            : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', { cause: error });
        }

        if (attempt === this.maxRetries - 1) {
          // Re-throw the original error if it's an AppError, otherwise wrap it.
          throw error instanceof AppError
            ? error
            : new AppError('Max retries exceeded', 'system', 'MAX_RETRIES_EXCEEDED', {
                cause: error,
              });
        }

        const delay = this.calculateDelay(attempt);
        if (onRetry) {
          onRetry(errorInstance, attempt + 1); // Pass attempt number (1-based for onRetry)
        }

        await new Promise(resolve => setTimeout(resolve, delay));
        attempt++;
      }
    }

    throw new Error('Max retries exceeded');
  }

  public static isRetryableError(error: Error): boolean {
    const appError = error as AppError;
    return appError.retryable !== undefined;
  }

  public static getRetryAfter(error: Error): number | undefined {
    const appError = error as AppError;
    return appError.retryAfter;
  }
}
