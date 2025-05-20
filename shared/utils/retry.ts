import { AppError, RetryableError } from '../types/errors';

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
    const delay = Math.min(
      this.baseDelay * Math.pow(2, attempt),
      this.maxDelay
    );
    return Math.floor(delay * (1 + Math.random() * 0.2)); // Add 0-20% jitter
  }

  public async retry<T>(
    operation: () => Promise<T>,
    errorFilter: (error: Error) => boolean = (error) => {
      const appError = error as AppError;
      return appError.retryable !== undefined;
    },
    onRetry?: (error: Error, attempt: number) => void
  ): Promise<T> {
    let attempt = 0;

    while (attempt < this.maxRetries) {
      try {
        return await operation();
      } catch (error) {
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

  public static isRetryableError(error: Error): boolean {
    const appError = error as AppError;
    return appError.retryable !== undefined;
  }

  public static getRetryAfter(error: Error): number | undefined {
    const appError = error as AppError;
    return appError.retryAfter;
  }
}
