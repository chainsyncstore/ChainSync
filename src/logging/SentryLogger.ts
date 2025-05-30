// src/logging/SentryLogger.ts
import * as Sentry from '@sentry/node';

import { BaseLogger, LogLevel, LogMeta, LoggableError, Logger } from './Logger';

interface SentryLoggerOptions {
  dsn: string;
  environment?: string;
  release?: string;
  serverName?: string;
  tracesSampleRate?: number;
  maxBreadcrumbs?: number;
  debug?: boolean;
  attachStacktrace?: boolean;
}

/**
 * Initialize Sentry with proper configuration
 * This should be called once at application startup
 */
export function initSentry(options: SentryLoggerOptions): void {
  Sentry.init({
    dsn: options.dsn,
    environment: options.environment || process.env.NODE_ENV || 'development',
    release: options.release,
    serverName: options.serverName,
    integrations: [
      Sentry.onUncaughtExceptionIntegration({
        onFatalError: (error: unknown) => {
          console.error('FATAL ERROR - UNCAUGHT EXCEPTION:');
          console.error(error);
          process.exit(1);
        },
      }),
      Sentry.onUnhandledRejectionIntegration({ mode: 'warn' }),
    ],
    tracesSampleRate: options.tracesSampleRate || 0.2,
    maxBreadcrumbs: options.maxBreadcrumbs || 100,
    debug: options.debug || false,
    attachStacktrace: options.attachStacktrace || true,
  });
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
    // Set user context in Sentry
    Sentry.setUser({
      id: user.id.toString(),
      email: user.email,
      username: user.username,
    });

    // Also add to our local context
    this.addContext({ user: { id: user.id } });
  }

  public clearUser(): void {
    Sentry.setUser(null);
  }

  public setRequestContext(req: unknown): void {
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

    // Set transaction in Sentry
    const transaction = `${req.method} ${req.path || req.url}`;
    Sentry.withScope(scope => {
      scope.setTransactionName(transaction);
    });

    this.addContext({ request: requestContext });
  }

  protected logMessage(level: LogLevel, message: string, meta?: LogMeta): void {
    // Log to console first
    this.consoleLogger.info(message, { ...this.context, ...meta });

    // Only send warnings and above to Sentry
    if (level >= LogLevel.WARN) {
      const breadcrumb = {
        type: 'default',
        category: 'log',
        level: this.getSentryLevel(level) as Sentry.SeverityLevel,
        message,
        data: meta,
      };

      Sentry.addBreadcrumb(breadcrumb);

      if (level >= LogLevel.ERROR) {
        this.captureMessage(level, message, meta);
      }
    }
  }

  protected logError(level: LogLevel, message: string, error: Error | LoggableError, meta?: LogMeta): void {
    // Log to console first
    if (error instanceof Error) {
      this.consoleLogger.error(message, error, meta);
    } else {
      this.consoleLogger.error(message, { ...meta, error });
    }

    // Capture in Sentry
    this.captureException(level, message, error, meta);
  }

  private captureMessage(level: LogLevel, message: string, meta?: LogMeta): void {
    Sentry.withScope(scope => {
      // Add context
      if (this.context) {
        Object.entries(this.context).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
      }

      // Add meta
      if (meta) {
        Object.entries(meta).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
      }

      scope.setLevel(this.getSentryLevel(level));
      Sentry.captureMessage(message);
    });
  }

  private captureException(level: LogLevel, message: string, error: Error | LoggableError, meta?: LogMeta): void {
    Sentry.withScope(scope => {
      // Add context
      if (this.context) {
        Object.entries(this.context).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
      }

      // Add meta
      if (meta) {
        Object.entries(meta).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
      }

      // Add custom message
      scope.setExtra('message', message);

      // Set error info
      if ('code' in error && error.code) {
        scope.setTag('error.code', error.code);
      }
      if ('status' in error && error.status) {
        scope.setTag('error.status', error.status.toString());
      }
      if ('meta' in error && error.meta) {
        scope.setExtra('error.meta', error.meta);
      }

      scope.setLevel(this.getSentryLevel(level));
      Sentry.captureException(error);
    });
  }

  private getSentryLevel(level: LogLevel): Sentry.SeverityLevel {
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
