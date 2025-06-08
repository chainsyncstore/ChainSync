// src/logging/index.ts
import { Logger, LogLevel, LogMeta, ConsoleLogger } from './Logger.js';
import { requestLogger, errorLogger, getRequestLogger } from './middleware.js';
import {
  SecurityLogger,
  createSecurityLogger,
  SecurityEventType,
  SecuritySeverity,
} from './SecurityLogger.js';
import { SentryLogger, createSentryLogger } from './SentryLogger.js';
import { TracingLogger, createTracingLogger } from './TracingLogger.js';

// Default logger instance - starts as ConsoleLogger but can be replaced
let activeLogger: Logger = new ConsoleLogger(
  process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG
);

/**
 * Configure the logging system
 */
export function configureLogging(options: {
  // Set to true to use Sentry
  useSentry?: boolean;

  // Sentry DSN if using Sentry
  sentryDsn?: string;

  // Environment override (defaults to NODE_ENV)
  environment?: string;

  // Application version
  release?: string;

  // Minimum log level
  level?: LogLevel;

  // Global context to include in all logs
  context?: LogMeta;

  // Set to true to enable distributed tracing
  enableTracing?: boolean;

  // Set to true to enable security logging
  enableSecurityLogging?: boolean;
}): Logger {
  // Start with defaults
  const env = options.environment || process.env.NODE_ENV || 'development';
  const level = options.level || (env === 'production' ? LogLevel.INFO : LogLevel.DEBUG);

  // Create base logger
  let baseLogger: Logger;

  if (options.useSentry && options.sentryDsn) {
    // Use Sentry in production
    baseLogger = createSentryLogger({
      dsn: options.sentryDsn,
      environment: env,
      release: options.release,
      debug: env !== 'production',
      tracesSampleRate: env === 'production' ? 0.2 : 1.0,
    });
  } else {
    // Use console logger
    baseLogger = new ConsoleLogger(level);
  }

  // Enable security logging if requested
  if (options.enableSecurityLogging) {
    // Wrap with security logger
    baseLogger = createSecurityLogger(baseLogger);
  }

  // Wrap with tracing logger if enabled
  if (options.enableTracing) {
    // Wrap with tracing if enabled
    baseLogger = createTracingLogger(baseLogger);
  }

  // Add context
  if (options.context) {
    baseLogger.addContext(options.context);
  }

  activeLogger = baseLogger;

  return activeLogger;
}

/**
 * Get the active logger instance
 */
export function getLogger(): Logger {
  return activeLogger;
}

/**
 * Create a logger with a specific context
 */
export function createLogger(context: LogMeta): Logger {
  return activeLogger.child(context);
}

/**
 * Replace the active logger - useful for testing
 */
export function setLogger(logger: Logger): void {
  activeLogger = logger;
}

// Export interfaces, types, and enums for proper TypeScript handling
export type { Logger, LogMeta, LoggableError } from './Logger.js';

// Export enums and constants
export { LogLevel } from './Logger.js';
export { SecurityEventType, SecuritySeverity } from './SecurityLogger.js';

// Export classes
export { ConsoleLogger } from './Logger.js';
export { SentryLogger } from './SentryLogger.js';
export { TracingLogger } from './TracingLogger.js';
export { SecurityLogger } from './SecurityLogger.js';

// Export factory functions
export { createSentryLogger } from './SentryLogger.js';
export { createTracingLogger } from './TracingLogger.js';
export { createSecurityLogger } from './SecurityLogger.js';

// Export middleware
export { requestLogger, errorLogger, getRequestLogger } from './middleware.js';

// Our utility functions are already defined above, no need to re-export them

// Export our default logger implementation
export default activeLogger;
