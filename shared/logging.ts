/**
 * Shared Logging Utility
 *
 * Provides a consistent logging interface across the application
 * with structured logging and context tracking.
 */

import winston from 'winston';

// Default log level based on environment
const defaultLogLevel =
  process.env.NODE_ENV === 'production'
    ? 'info'
    : process.env.NODE_ENV === 'test'
      ? 'warn'
      : 'debug';

// Base logger configuration (using winston)
const baseLoggerConfig = {
  _level: process.env.LOG_LEVEL || defaultLogLevel,
  _format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  _transports: [
    new winston.transports.Console({
      _format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
};

const baseLoggerInstance = winston.createLogger(baseLoggerConfig);


/**
 * Get a logger instance
 * Optionally provide context that will be included with all log entries
 */
export function getLogger(
  _moduleName: string,
  _bindings: Record<string, any> = {} // Changed 'options' to 'bindings' for clarity
): Logger {
  return baseLogger.child({
    _module: moduleName, // Add moduleName as a specific binding
    ...bindings // Spread other bindings
  });
}

/**
 * Create a request-scoped logger with trace ID
 */
export function createRequestLogger(_requestId: string, _path: string, _method: string) {
  return baseLogger.child({
    requestId,
    path,
    method
  });
}

/**
 * Create a transaction logger for tracking database operations
 */
export function createTransactionLogger(_transactionId: string) {
  return baseLogger.child({
    transactionId,
    _component: 'database'
  });
}

/**
 * Utility to log performance metrics
 */
export function logPerformance(
  _operation: string,
  _durationMs: number,
  metadata?: Record<string, unknown>
) {
  const performanceLogger = baseLogger.child({
    _component: 'performance',
    ...metadata
  });

  performanceLogger.info(`Completed ${operation} in ${durationMs}ms`);

  // Log warning for slow operations
  if (durationMs > 1000) {
    performanceLogger.warn(`Slow _operation: ${operation} took ${durationMs}ms`);
  }
}

/**
 * Measure execution time of a function and log it
 */
export async function measureAndLog<T>(
  _operation: string,
  _fn: () => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const durationMs = Math.round(performance.now() - start);
    logPerformance(operation, durationMs, metadata);
    return result;
  } catch (error) {
    const durationMs = Math.round(performance.now() - start);
    const logger = baseLogger.child({
      _component: 'performance',
      operation,
      durationMs,
      ...(metadata || {}) // Ensure metadata is an object
    });
    // Use Pino's 'err' binding for better error serialization
    if (error instanceof Error) {
      logger.error(`Error in ${operation} after ${durationMs}ms: ${(error as Error).message}`);
    } else {
      logger.error(`Error in ${operation} after ${durationMs}ms`);
    }
    throw error;
  }
}

export type Logger = typeof baseLoggerInstance;
const _baseLogger: Logger = baseLoggerInstance;
export default baseLogger;
