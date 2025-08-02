import { ErrorCode, ErrorCategory } from '@shared/types/errors';

export interface IServiceError extends Error {
  code: ErrorCode;
  category: ErrorCategory;
  retryable?: boolean;
  retryAfter: number;
  details: Record<string, unknown>;
}

export class ServiceError extends Error implements IServiceError {
  constructor(
    message: string,
    public code: ErrorCode,
    public category: ErrorCategory,
    public retryable: boolean = false,
    public retryAfter: number = 0,
    public details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

export abstract class BaseService {
  protected handleError(error: unknown, context: string): never {
    const serviceError = this.convertToServiceError(error);
    /* eslint-disable no-console */
    console.error(`[${this.constructor.name}] ${context} failed:`, serviceError);
    /* eslint-enable */
    throw serviceError;
  }

  protected convertToServiceError(error: unknown): IServiceError {
    if (error instanceof ServiceError) return error;

    const msg =
      error && typeof error === 'object' && 'message' in error
        ? String((error as any).message)
        : 'Unknown error';

    return new ServiceError(
      msg,
      ErrorCode.INTERNAL_SERVER_ERROR,
      ErrorCategory.SYSTEM,
      false,
      0,
      { originalError: error }
    );
  }

  /* Simple wrappers ---------------------------------------------------- */

  protected async withTransaction<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (err) {
      this.handleError(err, context); // never returns
    }
  }

  protected async withRetry<T>(
    operation: () => Promise<T>,
    context: string,
    maxRetries = 3,
    baseDelay = 1000
  ): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
      try {
        return await operation();
      } catch (err) {
        const e = this.convertToServiceError(err);
        if (!e.retryable || attempt === maxRetries - 1) throw e;
        await new Promise((r) => setTimeout(r, baseDelay * 2 ** attempt));
      }
    }
    /* istanbul ignore next */
    throw new ServiceError(
      'Max retries exceeded',
      ErrorCode.TEMPORARY_UNAVAILABLE,
      ErrorCategory.SYSTEM,
      true
    );
  }
}
