// src/logging/setup.ts
import { configureLogging, LogLevel, requestLogger, errorLogger, SentryLogger } from './index';
import express from 'express';
import os from 'os';
import { version } from '../../package.json';

/**
 * Configure and set up the centralized logging system for the application
 * This should be called once at application startup
 */
export function setupLogging(app: express.Application): void {
  // Get environment variables
  const nodeEnv = process.env.NODE_ENV || 'development';
  const useSentry = nodeEnv === 'production' || process.env.USE_SENTRY === 'true';
  const sentryDsn = process.env.SENTRY_DSN;
  
  // Configure global logger with application context
  const logger = configureLogging({
    useSentry,
    sentryDsn,
    environment: nodeEnv,
    release: version,
    level: getLogLevelFromEnv(),
    context: {
      app: 'ChainSync',
      version,
      hostname: os.hostname(),
      environment: nodeEnv
    }
  });
  
  logger.info('Logging system initialized', {
    environment: nodeEnv,
    useSentry: useSentry,
    level: LogLevel[logger.getLevel()]
  });
  
  // Add request logging middleware
  app.use(requestLogger(logger));
  
  // Add error logging middleware (should be added before other error handlers)
  app.use(errorLogger(logger));
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
    default:
      // Default to INFO in production, DEBUG otherwise
      return process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG;
  }
}

/**
 * Capture fatal errors that would crash the application
 * This should be called once at application startup
 */
export function setupGlobalErrorHandlers(): void {
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('FATAL: Uncaught exception', error);
    
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
      logger.error('Unhandled promise rejection', reason instanceof Error ? reason : new Error(String(reason)));
    } catch (e) {
      // Last resort fallback if logger fails
      console.error('Failed to log unhandled rejection', e);
    }
  });
}
