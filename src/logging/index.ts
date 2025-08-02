// src/logging/index.ts
import { Logger, LogLevel, LogMeta, ConsoleLogger } from './Logger';
import { SentryLogger, createSentryLogger } from './SentryLogger';
// import { TracingLogger, createTracingLogger } from './TracingLogger';
import { requestLogger, errorLogger, getRequestLogger } from './middleware';

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
      ...(options.release && { release: options.release }),
      debug: env !== 'production',
      tracesSampleRate: env === 'production' ? 0.2 : 1.0
    });
  } else {
    // Use console logger
    baseLogger = new ConsoleLogger(level);
  }
  
  // Set global context if provided
  if (options.context) {
    baseLogger.addContext(options.context);
  }
  
  // Temporarily disable tracing to fix circular dependency
  // if (options.enableTracing) {
  //   activeLogger = new TracingLogger(baseLogger);
  // } else {
  activeLogger = baseLogger;
  // }
  
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

// Re-export everything from Logger
export { 
  ConsoleLogger, 
  SentryLogger,
  requestLogger,
  errorLogger,
  getRequestLogger
};

// Re-export types with proper syntax for isolatedModules
export type { 
  Logger, 
  LogMeta 
};

// Export LogLevel as both type and value
export { LogLevel };

// Temporarily comment out tracing exports
// export { TracingLogger, createTracingLogger };
