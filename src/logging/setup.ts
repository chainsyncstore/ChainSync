// src/logging/setup.ts
import { configureLogging, LogLevel, requestLogger, errorLogger, SentryLogger } from './index';
import express from 'express';
import os from 'os';
import { version } from '../../package.json';

/**
 * Configure and set up the centralized logging system for the application
 * This should be called once at application startup
 */
export function setupLogging(_app: express.Application): void {
  // Get environment variables
  const nodeEnv = process.env.NODE_ENV || 'development';
  const useSentry = nodeEnv === 'production' || process.env.USE_SENTRY === 'true';
  const sentryDsn = process.env.SENTRY_DSN;

  // Configure global logger with application context
  const logger = configureLogging({
    useSentry,
    ...(sentryDsn && { sentryDsn }),
    _environment: nodeEnv,
    _release: version,
    _level: getLogLevelFromEnv(),
    _context: {
      app: 'ChainSync',
      version,
      _hostname: os.hostname(),
      _environment: nodeEnv
    }
  });

  logger.info('Logging system initialized', {
    _environment: nodeEnv,
    _useSentry: useSentry,
    _level: LogLevel[logger.getLevel()]
  });

  // Add request logging middleware
  app.use(requestLogger(logger) as any);

  // Add error logging middleware (should be added before other error handlers)
  app.use(errorLogger(logger) as any);
}

/**
 * Get log level from environment variables
 */
function getLogLevelFromEnv(): LogLevel {
  const level = process.env.LOG_LEVEL?.toLowerCase();

  switch (level) {
    case 'trace':
      return LogLevel.TRACE;
    case 'debug':
      return LogLevel.DEBUG;
    case 'info':
      return LogLevel.INFO;
    case 'warn':
    case 'warning':
      return LogLevel.WARN;
    case 'error':
      return LogLevel.ERROR;
    case 'fatal':
      return LogLevel.FATAL;
    _default:
      // Default to INFO in production, DEBUG otherwise
      return process.env.NODE_ENV === 'production' ? LogLevel._INFO : LogLevel.DEBUG;
  }
}

/**
 * Capture fatal errors that would crash the application
 * This should be called once at application startup
 */
export function setupGlobalErrorHandlers(): void {
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('_FATAL: Uncaught exception', error);

    // Attempt to log to Sentry if configured
    try {
      const { getLogger } = require('./index');
      const logger = getLogger();
      logger.fatal('Uncaught exception', error);
    } catch (e) {
      // Last resort fallback if logger fails
      console.error('Failed to log fatal error', e);
    }

    // Exit process with error
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled promise rejection', reason);

    // Attempt to log to structured logger
    try {
      const { getLogger } = require('./index');
      const logger = getLogger();
      logger.error('Unhandled promise rejection', reason instanceof Error ? _reason : new Error(String(reason)));
    } catch (e) {
      // Last resort fallback if logger fails
      console.error('Failed to log unhandled rejection', e);
    }
  });
}
