import { AppError, ErrorCode, ErrorCategory } from '@shared/types/errors';

export interface IServiceError extends Error {
  code: ErrorCode;
  category: ErrorCategory;
  retryable?: boolean;
  retryAfter?: number;
  details?: Record<string, unknown>;
}

export interface IServiceResult<T> {
  success: boolean;
  data?: T;
  error?: IServiceError;
  message?: string;
}

export class ServiceError extends Error implements IServiceError {
  constructor(
    message: string,
    public code: ErrorCode,
    public category: ErrorCategory,
    public retryable?: boolean,
    public retryAfter?: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

export abstract class BaseService {
  protected handleError(error: Error, context: string): never {
    const serviceError = this.convertToServiceError(error);
    console.error(`[${this.constructor.name}] ${context} failed:`, serviceError);
    throw serviceError;
  }

  protected convertToServiceError(error: Error): IServiceError {
    if (error instanceof ServiceError) {
      return error;
    }

    return new ServiceError(
      error.message,
      ErrorCode.INTERNAL_SERVER_ERROR,
      ErrorCategory.SYSTEM,
      false,
      undefined,
      { originalError: error.message }
    );
  }

  protected async withTransaction<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      this.handleError(error, context);
    }
  }

  protected async withRetry<T>(
    operation: () => Promise<T>,
    context: string,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        return await operation();
      } catch (error) {
        const serviceError = this.convertToServiceError(error);
        
        if (!serviceError.retryable || attempt === maxRetries - 1) {
          throw serviceError;
        }

        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        attempt++;
      }
    }

    throw new ServiceError(
      'Max retries exceeded',
      ErrorCode.TEMPORARY_UNAVAILABLE,
      ErrorCategory.SYSTEM,
      true,
      baseDelay * Math.pow(2, maxRetries - 1)
    );
  }
}
