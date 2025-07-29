// src/logging/SentryLogger.ts
// Sentry integration disabled for now - add @sentry/node to dependencies if needed
// Sentry integration disabled - using no-op implementations

import { BaseLogger, LogLevel, LogMeta, LoggableError, Logger } from './Logger';

export interface SentryLoggerOptions {
  dsn: string;
  environment?: string;
  release?: string;
  serverName?: string;
  tracesSampleRate?: number;
  maxBreadcrumbs?: number;
  debug?: boolean;
  attachStacktrace?: boolean;
  beforeSend?: (event: any) => any;
}

/**
 * Initialize Sentry for error tracking and performance monitoring
 * This should be called once at application startup
 */
export function initSentry(options: SentryLoggerOptions): void {
  // Sentry disabled - no-op
  console.log('Sentry initialization skipped (disabled)');
}

/**
 * Capture an exception with Sentry
 */
export function captureException(error: Error, context?: Record<string, any>): void {
  // Sentry disabled - no-op
  console.error('Exception captured (Sentry disabled):', error.message, context);
}

/**
 * Capture a message with Sentry
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  // Sentry disabled - no-op
  console.log(`Sentry message (${level}):`, message);
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(message: string, category?: string, data?: Record<string, any>): void {
  // Sentry disabled - no-op
}

/**
 * Set user context for Sentry
 */
export function setUserContext(user: { id?: string | number; email?: string; username?: string }): void {
  // Sentry disabled - no-op
}

/**
 * Set extra context for Sentry
 */
export function setExtraContext(key: string, value: any): void {
  // Sentry disabled - no-op
}

/**
 * Flush Sentry events (useful for serverless)
 */
export async function flush(timeout = 2000): Promise<boolean> {
  // Sentry disabled - no-op
  return true;
}

/**
 * Sentry Logger implementation for production environments
 * Sends errors to Sentry while also logging to console
 */
export class SentryLogger extends BaseLogger {
  private consoleLogger: Logger;

  constructor(level?: LogLevel, context?: LogMeta) {
    super(level, context);
    this.consoleLogger = new ConsoleLogger(level, context);
  }

  protected createChildLogger(): Logger {
    return new SentryLogger(this.level, this.context);
  }

  public setUser(user: { id: string | number; email?: string; username?: string }): void {
    // Sentry disabled - no-op
  }

  public clearUser(): void {
    // Sentry disabled - no-op
  }

  public setRequestContext(req: any): void {
    // Extract useful context from Express/HTTP request
    const requestContext: Record<string, any> = {
      url: req.url,
      method: req.method,
      query: req.query,
    };

    if (req.body && Object.keys(req.body).length > 0) {
      // Filter sensitive data
      const filteredBody = { ...req.body };
      const sensitiveFields = ['password', 'token', 'secret', 'credit_card', 'card'];
      
      sensitiveFields.forEach(field => {
        if (field in filteredBody) {
          filteredBody[field] = '[FILTERED]';
        }
      });

      requestContext.body = filteredBody;
    }

    if (req.headers) {
      // Only include safe headers
      const safeHeaders = ['user-agent', 'accept', 'content-type', 'referer'];
      const headers: Record<string, string> = {};
      
      safeHeaders.forEach(header => {
        if (header in req.headers) {
          headers[header] = req.headers[header];
        }
      });

      requestContext.headers = headers;
    }

    // Sentry disabled - no-op

    this.addContext({ request: requestContext });
  }

  protected logMessage(level: LogLevel, message: string, meta?: LogMeta): void {
    // Log to console only (Sentry disabled)
    this.consoleLogger.info(message, { ...this.context, ...meta });
  }

  protected logError(level: LogLevel, message: string, error: Error | LoggableError, meta?: LogMeta): void {
    // Log to console only (Sentry disabled)
    if (error instanceof Error) {
      this.consoleLogger.error(message, error, meta);
    } else {
      this.consoleLogger.error(message, { ...meta, error });
    }
  }

  private captureMessage(level: LogLevel, message: string, meta?: LogMeta): void {
    // Sentry disabled - no-op
  }

  private captureException(level: LogLevel, message: string, error: Error | LoggableError, meta?: LogMeta): void {
    // Sentry disabled - no-op
  }

  private getSentryLevel(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return 'debug';
      case LogLevel.INFO:
        return 'info';
      case LogLevel.WARN:
        return 'warning';
      case LogLevel.ERROR:
        return 'error';
      case LogLevel.FATAL:
        return 'fatal';
      default:
        return 'info';
    }
  }
}

// Import this at the end to avoid circular dependency
import { ConsoleLogger } from './Logger';

// Factory function to create a Sentry logger
export function createSentryLogger(options: SentryLoggerOptions): SentryLogger {
  initSentry(options);
  return new SentryLogger(
    process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG
  );
}
