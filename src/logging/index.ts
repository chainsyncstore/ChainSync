// src/logging/index.ts
import { Logger, LogLevel, LogMeta, ConsoleLogger } from './Logger';
import { requestLogger, errorLogger, getRequestLogger } from './middleware';
import {
  SecurityLogger,
  createSecurityLogger,
  SecurityEventType,
  SecuritySeverity,
} from './SecurityLogger';
import { SentryLogger, createSentryLogger } from './SentryLogger';
import { TracingLogger, createTracingLogger } from './TracingLogger';

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
export type { Logger, LogMeta, LoggableError } from './Logger';

// Export enums and constants
export { LogLevel } from './Logger';
export { SecurityEventType, SecuritySeverity } from './SecurityLogger';

// Export classes
export { ConsoleLogger } from './Logger';
export { SentryLogger } from './SentryLogger';
export { TracingLogger } from './TracingLogger';
export { SecurityLogger } from './SecurityLogger';

// Export factory functions
export { createSentryLogger } from './SentryLogger';
export { createTracingLogger } from './TracingLogger';
export { createSecurityLogger } from './SecurityLogger';

// Export middleware
export { requestLogger, errorLogger, getRequestLogger } from './middleware';

// Our utility functions are already defined above, no need to re-export them

// Export our default logger implementation
export default activeLogger;
