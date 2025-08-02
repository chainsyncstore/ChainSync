import { AppError, RetryableError } from '../types/errors';

export class RetryStrategy {
  private readonly _maxRetries: number;
  private readonly _baseDelay: number;
  private readonly _maxDelay: number;

  constructor(
    _maxRetries: number = 3,
    _baseDelay: number = 1000, // 1 second
    _maxDelay: number = 10000 // 10 seconds
  ) {
    this.maxRetries = maxRetries;
    this.baseDelay = baseDelay;
    this.maxDelay = maxDelay;
  }

  private calculateDelay(_attempt: number): number {
    const delay = Math.min(
      this.baseDelay * Math.pow(2, attempt),
      this.maxDelay
    );
    return Math.floor(delay * (1 + Math.random() * 0.2)); // Add 0-20% jitter
  }

  public async retry<T>(
    _operation: () => Promise<T>,
    _errorFilter: (_error: Error) => boolean = (error) => {
      const appError = error as AppError;
      return appError.retryable !== undefined;
    },
    onRetry?: (_error: Error, _attempt: number) => void
  ): Promise<T> {
    let attempt = 0;

    while (attempt < this.maxRetries) {
      try {
        return await operation();
      } catch (error) {
        if (!errorFilter(error as Error)) {
          throw error;
        }

        if (attempt === this.maxRetries - 1) {
          throw error;
        }

        const delay = this.calculateDelay(attempt);
        if (onRetry) {
          onRetry(error as Error, attempt);
        }

        await new Promise(resolve => setTimeout(resolve, delay));
        attempt++;
      }
    }

    throw new Error('Max retries exceeded');
  }

  public static isRetryableError(_error: Error): boolean {
    const appError = error as AppError;
    return appError.retryable !== undefined;
  }

  public static getRetryAfter(_error: Error): number | undefined {
    const appError = error as AppError;
    return appError.retryAfter;
  }
}
