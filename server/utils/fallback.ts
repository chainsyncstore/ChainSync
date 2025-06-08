import { AppError } from '@shared/types/errors';

import { retry, RetryOptions } from './retry';
import { getLogger } from '../../src/logging/index';

const logger = getLogger().child({ component: 'fallback-utils' });

/**
 * Configuration options for fallback operations
 */
export interface FallbackOptions<T> {
  /** Array of fallback functions to try in order */
  fallbacks: Array<() => Promise<T>>;

  /** Retry options for each attempt */
  retryOptions?: RetryOptions;

  /** Validation function to check if a result is valid/usable */
  validator?: (result: T) => boolean;

  /** Default value to return if all fallbacks fail */
  defaultValue?: T;

  /** Operation name for logging purposes */
  operationName?: string;

  /** Whether to throw an error if all fallbacks fail (default: true) */
  throwOnFailure?: boolean;
}

/**
 * Result of a fallback operation
 */
export interface FallbackResult<T> {
  /** Whether any of the fallbacks succeeded */
  success: boolean;

  /** The result from the successful fallback */
  result?: T;

  /** The index of the successful fallback */
  fallbackIndex?: number;

  /** The error from the last fallback if all failed */
  error?: unknown;

  /** Total time spent across all fallbacks */
  totalTimeMs: number;

  /** Whether the default value was used */
  usedDefaultValue: boolean;
}

/**
 * Execute a primary function with fallbacks in case of failure
 *
 * @param primaryFn The primary function to execute
 * @param options Fallback configuration options
 * @returns Result of the fallback operation
 */
export async function withFallback<T>(
  primaryFn: () => Promise<T>,
  options: FallbackOptions<T>
): Promise<FallbackResult<T>> {
  const startTime = Date.now();
  const opName = options.operationName || 'unnamed-operation';
  const throwOnFailure = options.throwOnFailure !== false;

  // Create the full list of functions to try (primary + fallbacks)
  const allFunctions = [primaryFn, ...options.fallbacks];

  let lastError: unknown;

  // Try each function in order
  for (let i = 0; i < allFunctions.length; i++) {
    const fn = allFunctions[i];
    const functionType = i === 0 ? 'primary' : `fallback[${i - 1}]`;

    try {
      // Attempt the function with retry logic if enabled
      let result: T;

      if (options.retryOptions) {
        const retryResult = await retry(fn, {
          ...options.retryOptions,
          operationName: `${opName}:${functionType}`,
        });

        if (!retryResult.success) {
          throw retryResult.error;
        }

        result = retryResult.result as T;
      } else {
        result = await fn();
      }

      // Validate the result if a validator is provided
      if (options.validator && !options.validator(result)) {
        throw new Error(`${functionType} returned invalid result`);
      }

      // Log success
      if (i > 0) {
        logger.info(`Operation ${opName} succeeded with ${functionType}`, {
          fallbackIndex: i - 1,
          totalTimeMs: Date.now() - startTime,
        });
      }

      return {
        success: true,
        result,
        fallbackIndex: i === 0 ? undefined : i - 1,
        totalTimeMs: Date.now() - startTime,
        usedDefaultValue: false,
      };
    } catch (error: unknown) {
      lastError = error;

      logger.warn(`${functionType} failed for operation ${opName}`, {
        error: error instanceof Error ? error.message : String(error),
        remainingFallbacks: allFunctions.length - i - 1,
      });
    }
  }

  // If we've reached this point, all functions failed

  // Return the default value if provided
  if (options.defaultValue !== undefined) {
    logger.warn(`All fallbacks failed for operation ${opName}, using default value`, {
      totalTimeMs: Date.now() - startTime,
    });

    return {
      success: true,
      result: options.defaultValue,
      totalTimeMs: Date.now() - startTime,
      usedDefaultValue: true,
    };
  }

  // Otherwise return failure
  logger.error(`All fallbacks failed for operation ${opName}`, {
    error: lastError,
    totalTimeMs: Date.now() - startTime,
  });

  // Throw the error if configured to do so
  if (throwOnFailure) {
    throw lastError;
  }

  return {
    success: false,
    error: lastError,
    totalTimeMs: Date.now() - startTime,
    usedDefaultValue: false,
  };
}

/**
 * Create a function that automatically applies fallback logic
 *
 * @param primaryFn The primary function to execute
 * @param options Fallback configuration options
 * @returns A new function that includes fallback logic
 */
export function createWithFallback<T, Args extends any[]>(
  primaryFn: (...args: Args) => Promise<T>,
  options: Omit<FallbackOptions<T>, 'fallbacks'> & {
    fallbacks: Array<(...args: Args) => Promise<T>>;
  }
): (...args: Args) => Promise<T> {
  return async (...args: Args): Promise<T> => {
    const result = await withFallback(() => primaryFn(...args), {
      ...options,
      fallbacks: options.fallbacks.map(fn => () => fn(...args)),
    });

    if (!result.success) {
      throw result.error;
    }

    return result.result as T;
  };
}

/**
 * Circuit breaker state for tracking failures
 */
interface CircuitBreakerState {
  /** Number of consecutive failures */
  failureCount: number;

  /** Timestamp when the circuit was opened (if in OPEN state) */
  openedAt?: number;

  /** Circuit state: CLOSED (normal), OPEN (failing), HALF_OPEN (testing) */
  status: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

/**
 * Configuration options for the circuit breaker
 */
export interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening the circuit (default: 5) */
  failureThreshold?: number;

  /** Time in milliseconds to keep the circuit open before attempting reset (default: 30000) */
  resetTimeoutMs?: number;

  /** Operation name for logging purposes */
  operationName?: string;
}

/**
 * Circuit Breaker pattern implementation
 * Prevents repeated calls to a failing service and allows for graceful recovery
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = {
    failureCount: 0,
    status: 'CLOSED',
  };

  private options: Required<CircuitBreakerOptions>;

  constructor(options: CircuitBreakerOptions = {}) {
    this.options = {
      failureThreshold: options.failureThreshold ?? 5,
      resetTimeoutMs: options.resetTimeoutMs ?? 30000,
      operationName: options.operationName ?? 'unnamed-circuit',
    };
  }

  /**
   * Execute a function with circuit breaker protection
   *
   * @param fn The function to execute
   * @returns The result of the function if successful
   * @throws CircuitOpenError if the circuit is open
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if the circuit is open
    if (this.isOpen()) {
      // Check if it's time to try resetting the circuit
      if (this.shouldAttemptReset()) {
        logger.info(`Attempting to reset circuit for ${this.options.operationName}`, {
          previousStatus: this.state.status,
          newStatus: 'HALF_OPEN',
        });

        // Set to half-open state to test the service
        this.state.status = 'HALF_OPEN';
      } else {
        // Circuit is still open, fast fail
        logger.warn(`Circuit open for ${this.options.operationName}, fast failing`, {
          openedAt: this.state.openedAt,
          resetTimeoutMs: this.options.resetTimeoutMs,
        });

        throw new CircuitOpenError(`Circuit breaker open for ${this.options.operationName}`);
      }
    }

    try {
      // Execute the function
      const result = await fn();

      // Success, reset failure count and close circuit if in half-open state
      if (this.state.status === 'HALF_OPEN') {
        logger.info(`Circuit reset successful for ${this.options.operationName}`, {
          previousStatus: this.state.status,
          newStatus: 'CLOSED',
        });
      }

      this.state.failureCount = 0;
      this.state.status = 'CLOSED';
      this.state.openedAt = undefined;

      return result;
    } catch (error: unknown) {
      // Increment failure count
      this.state.failureCount++;

      // Check if we need to open the circuit
      if (
        this.state.status === 'CLOSED' &&
        this.state.failureCount >= this.options.failureThreshold
      ) {
        // Open the circuit
        this.state.status = 'OPEN';
        this.state.openedAt = Date.now();

        logger.error(
          `Circuit opened for ${this.options.operationName} after ${this.state.failureCount} failures`,
          {
            error: error instanceof Error ? error.message : String(error),
            failureThreshold: this.options.failureThreshold,
          }
        );
      } else if (this.state.status === 'HALF_OPEN') {
        // Reset attempt failed, keep circuit open
        this.state.status = 'OPEN';
        this.state.openedAt = Date.now();

        logger.warn(`Circuit reset failed for ${this.options.operationName}, keeping open`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Re-throw the original error
      throw error instanceof AppError
        ? error
        : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
    }
  }

  /**
   * Create a protected version of a function with circuit breaker
   *
   * @param fn The function to protect
   * @returns A new function with circuit breaker protection
   */
  protect<T, Args extends any[]>(fn: (...args: Args) => Promise<T>): (...args: Args) => Promise<T> {
    return async (...args: Args): Promise<T> => {
      return this.execute(() => fn(...args));
    };
  }

  /**
   * Check if the circuit breaker is currently open (failing)
   */
  isOpen(): boolean {
    return this.state.status === 'OPEN';
  }

  /**
   * Check if we should attempt to reset the circuit
   */
  private shouldAttemptReset(): boolean {
    if (this.state.status !== 'OPEN' || !this.state.openedAt) {
      return false;
    }

    const elapsedTime = Date.now() - this.state.openedAt;
    return elapsedTime >= this.options.resetTimeoutMs;
  }

  /**
   * Reset the circuit breaker state
   */
  reset(): void {
    this.state = {
      failureCount: 0,
      status: 'CLOSED',
    };

    logger.info(`Circuit manually reset for ${this.options.operationName}`);
  }

  /**
   * Get the current state of the circuit breaker
   */
  getState(): Readonly<CircuitBreakerState> {
    return { ...this.state };
  }
}

/**
 * Error thrown when a circuit breaker is open
 */
export class CircuitOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}
