import { getLogger } from '../../src/logging/index.js';

const logger = getLogger().child({ component: 'retry-utils' });

/**
 * Configuration options for the retry operation
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;

  /** Initial delay between retries in milliseconds (default: 500) */
  initialDelayMs?: number;

  /** Factor by which to increase delay with each retry (default: 2) */
  backoffFactor?: number;

  /** Maximum delay between retries in milliseconds (default: 10000) */
  maxDelayMs?: number;

  /** Whether to use jitter to randomize delay times (default: true) */
  useJitter?: boolean;

  /** List of error types/messages that should not be retried */
  nonRetryableErrors?: Array<string | RegExp | Function>;

  /** Operation name for logging purposes */
  operationName?: string;

  /** Custom function to determine if an error is retryable */
  isRetryable?: (error: unknown) => boolean;
}

/**
 * Result of a retry operation including success/failure and metadata
 */
export interface RetryResult<T> {
  /** Whether the operation ultimately succeeded */
  success: boolean;

  /** The result of the operation if successful */
  result?: T;

  /** The error if the operation failed after all retries */
  error?: unknown;

  /** Number of attempts made */
  attempts: number;

  /** Total time spent in retry attempts in milliseconds */
  totalTimeMs: number;
}

/**
 * Default retry options
 */
const DEFAULT_OPTIONS: Required<
  Omit<RetryOptions, 'nonRetryableErrors' | 'operationName' | 'isRetryable'>
> = {
  maxAttempts: 3,
  initialDelayMs: 500,
  backoffFactor: 2,
  maxDelayMs: 10000,
  useJitter: true,
};

/**
 * Retry a function with exponential backoff
 *
 * @param fn The function to retry
 * @param options Retry configuration options
 * @returns Result of the retry operation
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();
  let attempts = 0;
  let lastError: unknown;
  let delay = config.initialDelayMs;

  const opName = config.operationName || 'unnamed-operation';

  while (attempts < config.maxAttempts) {
    attempts++;

    try {
      // Attempt the operation
      const result = await fn();

      // Log success and return the result
      if (attempts > 1) {
        logger.info(`Operation ${opName} succeeded after ${attempts} attempts`, {
          attempts,
          totalTimeMs: Date.now() - startTime,
        });
      }

      return {
        success: true,
        result,
        attempts,
        totalTimeMs: Date.now() - startTime,
      };
    } catch (error: unknown) {
      lastError = error;

      // Check if the error is non-retryable
      if (isNonRetryableError(error, config)) {
        logger.warn(`Non-retryable error encountered for operation ${opName}`, {
          error,
          attempts,
        });

        break;
      }

      // Check if we've reached the maximum attempts
      if (attempts >= config.maxAttempts) {
        logger.error(`Operation ${opName} failed after ${attempts} attempts`, {
          error,
          attempts,
          totalTimeMs: Date.now() - startTime,
        });

        break;
      }

      // Calculate the next delay with exponential backoff
      delay = Math.min(delay * config.backoffFactor, config.maxDelayMs);

      // Add jitter if enabled
      if (config.useJitter) {
        delay = addJitter(delay);
      }

      logger.warn(`Retry attempt ${attempts} for operation ${opName} after ${delay}ms delay`, {
        error: error instanceof Error ? error.message : String(error),
        attempt: attempts,
        nextDelayMs: delay,
      });

      // Wait before the next retry
      await sleep(delay);
    }
  }

  // If we've reached this point, all retries have failed
  return {
    success: false,
    error: lastError,
    attempts,
    totalTimeMs: Date.now() - startTime,
  };
}

/**
 * Add jitter to a delay time to prevent thundering herd problems
 */
function addJitter(delay: number): number {
  // Add or subtract up to 25% of the delay
  const jitterFactor = 0.25;
  const jitterAmount = delay * jitterFactor;
  return Math.max(1, delay - jitterAmount + Math.random() * jitterAmount * 2);
}

/**
 * Determine if an error should not be retried based on configuration
 */
function isNonRetryableError(error: unknown, options: RetryOptions): boolean {
  // Use the custom function if provided
  if (options.isRetryable) {
    return !options.isRetryable(error);
  }

  // No non-retryable errors specified
  if (!options.nonRetryableErrors || options.nonRetryableErrors.length === 0) {
    return false;
  }

  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorName = error instanceof Error ? error.constructor.name : typeof error;

  // Check against the list of non-retryable errors
  for (const nonRetryable of options.nonRetryableErrors) {
    if (typeof nonRetryable === 'string') {
      // String match against error message or name
      if (errorMessage.includes(nonRetryable) || errorName === nonRetryable) {
        return true;
      }
    } else if (nonRetryable instanceof RegExp) {
      // Regex match against error message
      if (nonRetryable.test(errorMessage)) {
        return true;
      }
    } else if (typeof nonRetryable === 'function') {
      // Check if error is an instance of the specified error class
      if (error instanceof nonRetryable) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Sleep for a specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a retryable version of a function
 *
 * @param fn The function to make retryable
 * @param options Retry configuration options
 * @returns A new function that retries the original function
 */
export function createRetryable<T, Args extends any[]>(
  fn: (...args: Args) => Promise<T>,
  options: RetryOptions = {}
): (...args: Args) => Promise<T> {
  return async (...args: Args): Promise<T> => {
    const result = await retry(() => fn(...args), options);

    if (!result.success) {
      throw result.error;
    }

    return result.result as T;
  };
}
