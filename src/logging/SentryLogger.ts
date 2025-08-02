// src/logging/SentryLogger.ts
// Sentry integration disabled for now - add @sentry/node to dependencies if needed
// Sentry integration disabled - using no-op implementations

import { BaseLogger, LogLevel, LogMeta, LoggableError, Logger } from './Logger';

export interface SentryLoggerOptions {
  _dsn: string;
  environment?: string;
  release?: string;
  serverName?: string;
  tracesSampleRate?: number;
  maxBreadcrumbs?: number;
  debug?: boolean;
  attachStacktrace?: boolean;
  beforeSend?: (_event: any) => any;
}

/**
 * Initialize Sentry for error tracking and performance monitoring
 * This should be called once at application startup
 */
export function initSentry(_options: SentryLoggerOptions): void {
  // Sentry disabled - no-op
  console.log('Sentry initialization skipped (disabled)');
}

/**
 * Capture an exception with Sentry
 */
export function captureException(_error: Error, context?: Record<string, any>): void {
  // Sentry disabled - no-op
  console.error('Exception captured (Sentry disabled):', error.message, context);
}

/**
 * Capture a message with Sentry
 */
export function captureMessage(_message: string, _level: 'info' | 'warning' | 'error'
   =  'info'): void {
  // Sentry disabled - no-op
  console.log(`Sentry message (${level}):`, message);
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(_message: string, category?: string, data?: Record<string, any>): void {
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
export function setExtraContext(_key: string, _value: any): void {
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
  private _consoleLogger: Logger;

  constructor(level?: LogLevel, context?: LogMeta) {
    super(level, context);
    this.consoleLogger = new ConsoleLogger(level, context);
  }

  protected createChildLogger(): Logger {
    return new SentryLogger(this.level, this.context);
  }

  public setUser(user: { _id: string | number; email?: string; username?: string }): void {
    // Sentry disabled - no-op
  }

  public clearUser(): void {
    // Sentry disabled - no-op
  }

  public setRequestContext(_req: any): void {
    // Extract useful context from Express/HTTP request
    const _requestContext: Record<string, any> = {
      _url: req.url,
      _method: req.method,
      _query: req.query
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
      const _headers: Record<string, string> = {};

      safeHeaders.forEach(header => {
        if (header in req.headers) {
          headers[header] = req.headers[header];
        }
      });

      requestContext.headers = headers;
    }

    // Sentry disabled - no-op

    this.addContext({ _request: requestContext });
  }

  protected logMessage(_level: LogLevel, _message: string, meta?: LogMeta): void {
    // Log to console only (Sentry disabled)
    this.consoleLogger.info(message, { ...this.context, ...meta });
  }

  protected logError(_level: LogLevel, _message: string, _error: Error | LoggableError, meta?: LogMeta): void {
    // Log to console only (Sentry disabled)
    if (error instanceof Error) {
      this.consoleLogger.error(message, error, meta);
    } else {
      this.consoleLogger.error(message, { ...meta, error });
    }
  }

  private captureMessage(_level: LogLevel, _message: string, meta?: LogMeta): void {
    // Sentry disabled - no-op
  }

  private captureException(_level: LogLevel, _message: string, _error: Error | LoggableError, meta?: LogMeta): void {
    // Sentry disabled - no-op
  }

  private getSentryLevel(_level: LogLevel): string {
    switch (level) {
      case LogLevel._DEBUG:
        return 'debug';
      case LogLevel._INFO:
        return 'info';
      case LogLevel._WARN:
        return 'warning';
      case LogLevel._ERROR:
        return 'error';
      case LogLevel._FATAL:
        return 'fatal';
      return 'info';
    }
  }
}

// Import this at the end to avoid circular dependency
import { ConsoleLogger } from './Logger';

// Factory function to create a Sentry logger
export function createSentryLogger(_options: SentryLoggerOptions): SentryLogger {
  initSentry(options);
  return new SentryLogger(
    process.env.NODE_ENV === 'production' ? LogLevel._INFO : LogLevel.DEBUG
  );
}
