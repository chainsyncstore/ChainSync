/**
 * Shared Logging Utility
 *
 * Provides a consistent logging interface across the application
 * with structured logging and context tracking.
 */

import pino from 'pino';

// Default log level based on environment
const defaultLogLevel =
  process.env.NODE_ENV === 'production'
    ? 'info'
    : process.env.NODE_ENV === 'test'
      ? 'warn'
      : 'debug';

// Base logger configuration
const baseLoggerInstance = pino({
  level: process.env.LOG_LEVEL || defaultLogLevel,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label: string) => {
      return { level: label };
    },
  },
  redact: {
    paths: [
      'password',
      'passwordHash',
      'token',
      'accessToken',
      'refreshToken',
      'authorization',
      'cookie',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.accessToken',
      '*.refreshToken',
      '*.authorization',
      '*.cookie',
    ],
    censor: '[REDACTED]',
  },
  // Development-friendly output in non-production environments
  ...(process.env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  }),
  serializers: pino.stdSerializers,
});

/**
 * Get a logger instance
 * Optionally provide context that will be included with all log entries
 */
export function getLogger(
  moduleName: string,
  bindings: Record<string, any> = {} // Changed 'options' to 'bindings' for clarity
): Logger {
  return baseLogger.child({
    module: moduleName, // Add moduleName as a specific binding
    ...bindings, // Spread other bindings
  });
}

/**
 * Create a request-scoped logger with trace ID
 */
export function createRequestLogger(requestId: string, path: string, method: string) {
  return baseLogger.child({
    requestId,
    path,
    method,
  });
}

/**
 * Create a transaction logger for tracking database operations
 */
export function createTransactionLogger(transactionId: string) {
  return baseLogger.child({
    transactionId,
    component: 'database',
  });
}

/**
 * Utility to log performance metrics
 */
export function logPerformance(
  operation: string,
  durationMs: number,
  metadata?: Record<string, unknown>
) {
  const performanceLogger = baseLogger.child({
    component: 'performance',
    ...metadata,
  });

  performanceLogger.info({ operation, durationMs }, `Completed ${operation} in ${durationMs}ms`);

  // Log warning for slow operations
  if (durationMs > 1000) {
    performanceLogger.warn(
      { operation, durationMs },
      `Slow operation: ${operation} took ${durationMs}ms`
    );
  }
}

/**
 * Measure execution time of a function and log it
 */
export async function measureAndLog<T>(
  operation: string,
  fn: () => Promise<T>,
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
      component: 'performance',
      operation,
      durationMs,
      ...(metadata || {}), // Ensure metadata is an object
    });
    // Use Pino's 'err' binding for better error serialization
    if (error instanceof Error) {
      logger.error({ err: error }, `Error in ${operation} after ${durationMs}ms`);
    } else {
      logger.error({ errorDetail: error }, `Error in ${operation} after ${durationMs}ms`);
    }
    throw error;
  }
}

export type Logger = typeof baseLoggerInstance;
const baseLogger: Logger = baseLoggerInstance;
export default baseLogger;
