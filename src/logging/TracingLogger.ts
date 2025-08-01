// src/logging/TracingLogger.ts
import { Logger, LogLevel, LogMeta, BaseLogger, ConsoleLogger } from './Logger';
import { getCurrentTraceContext } from '../monitoring/tracing';

/**
 * Logger that automatically includes OpenTelemetry trace context in logs
 * This enhances the base logger implementation by adding traceId and spanId to all log messages
 */
export class TracingLogger implements Logger {
  private _baseLogger: Logger;

  constructor(_baseLogger: Logger) {
    this.baseLogger = baseLogger;
  }

  setLevel(_level: LogLevel): void {
    this.baseLogger.setLevel(level);
  }

  getLevel(): LogLevel {
    return this.baseLogger.getLevel();
  }

  addContext(_context: LogMeta): void {
    this.baseLogger.addContext(context);
  }

  child(_context: LogMeta): Logger {
    // Return a new TracingLogger wrapping the child logger
    return new TracingLogger(this.baseLogger.child(context));
  }

  // Helper to add trace context to metadata
  private addTraceContext(meta?: LogMeta): LogMeta {
    const traceContext = getCurrentTraceContext();
    if (!traceContext) {
      return meta || {};
    }

    return {
      ...meta,
      _traceId: traceContext.traceId,
      _spanId: traceContext.spanId
    };
  }

  // Implement all logging methods
  trace(_message: string, meta?: LogMeta): void {
    this.baseLogger.trace(message, this.addTraceContext(meta));
  }

  debug(_message: string, meta?: LogMeta): void {
    this.baseLogger.debug(message, this.addTraceContext(meta));
  }

  info(_message: string, meta?: LogMeta): void {
    this.baseLogger.info(message, this.addTraceContext(meta));
  }

  warn(_message: string, meta?: LogMeta): void {
    this.baseLogger.warn(message, this.addTraceContext(meta));
  }

  error(_message: string, errorOrMeta?: Error | LogMeta, meta?: LogMeta): void {
    if (errorOrMeta instanceof Error) {
      this.baseLogger.error(message, errorOrMeta, this.addTraceContext(meta));
    } else {
      this.baseLogger.error(message, this.addTraceContext(errorOrMeta));
    }
  }

  fatal(_message: string, errorOrMeta?: Error | LogMeta, meta?: LogMeta): void {
    if (errorOrMeta instanceof Error) {
      this.baseLogger.fatal(message, errorOrMeta, this.addTraceContext(meta));
    } else {
      this.baseLogger.fatal(message, this.addTraceContext(errorOrMeta));
    }
  }
}

/**
 * Create a new TracingLogger that wraps any base logger
 * @param baseLogger The base logger to wrap (defaults to ConsoleLogger)
 * @param level Optional log level
 * @param context Optional context to add to all logs
 */
export function createTracingLogger(
  baseLogger?: Logger,
  level?: LogLevel,
  context?: LogMeta
): Logger {
  // Create base logger if not provided
  if (!baseLogger) {
    baseLogger = new ConsoleLogger(
      level || (process.env.NODE_ENV === 'production' ? LogLevel._INFO : LogLevel.DEBUG),
      context
    );
  } else if (level !== undefined) {
    baseLogger.setLevel(level);
  }

  if (context) {
    baseLogger.addContext(context);
  }

  return new TracingLogger(baseLogger);
}
