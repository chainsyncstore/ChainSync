import { ServiceConfig, ServiceResult } from '@shared/types/common';
import { AppError, ErrorCode, ErrorCategory } from '@shared/types/errors';

export interface IServiceError extends Error {
  code: ErrorCode;
  category: ErrorCategory;
  retryable?: boolean;
  retryAfter?: number;
  details?: Record<string, any>;
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
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

export abstract class BaseService {
  protected db;
  protected logger;

  constructor(config: ServiceConfig) {
    this.db = config.db;
    this.logger = config.logger;
  }

  protected async handleServiceCall<T>(
    serviceFunction: () => Promise<T>,
    errorCode: string
  ): Promise<ServiceResult<T>> {
    try {
      const result = await serviceFunction();
      return { success: true, data: result };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`${errorCode}: ${errorMessage}`);
      return {
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          details: error instanceof Error ? error : { message: errorMessage },
        },
      };
    }
  }

  protected handleError(error: unknown, context: string): never {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const serviceError = this.convertToServiceError(error);
    console.error(`[${this.constructor.name}] ${context} failed:`, serviceError);
    throw serviceError;
  }

  protected convertToServiceError(error: unknown): IServiceError {
    if (!(error instanceof Error)) {
      return new ServiceError(
        String(error),
        ErrorCode.INTERNAL_SERVER_ERROR,
        ErrorCategory.SYSTEM,
        false,
        undefined,
        { originalError: String(error) }
      );
    }
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

  protected async withTransaction<T>(operation: () => Promise<T>, context: string): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
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
      } catch (error: unknown) {
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
