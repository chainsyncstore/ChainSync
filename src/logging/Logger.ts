// src/logging/Logger.ts

/**
 * Log severity levels
 */
export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5
}

/**
 * Metadata type for structured logging
 */
export type LogMeta = Record<string, any>;

/**
 * Extended Error interface for custom error data
 */
export interface LoggableError extends Error {
  code?: string;
  status?: number;
  meta?: LogMeta;
}

/**
 * Enhanced Logger interface with structured logging capabilities
 */
export interface Logger {
  /**
   * Set minimum log level
   */
  setLevel(_level: LogLevel): void;

  /**
   * Get current log level
   */
  getLevel(): LogLevel;

  /**
   * Log a trace message
   */
  trace(_message: string, meta?: LogMeta): void;

  /**
   * Log a debug message
   */
  debug(_message: string, meta?: LogMeta): void;

  /**
   * Log an info message
   */
  info(_message: string, meta?: LogMeta): void;

  /**
   * Log a warning message
   */
  warn(_message: string, meta?: LogMeta): void;

  /**
   * Log an error message
   */
  error(_message: string, meta?: LogMeta): void;
  error(_message: string, _error: Error | LoggableError, meta?: LogMeta): void;

  /**
   * Log a fatal error message
   */
  fatal(_message: string, meta?: LogMeta): void;
  fatal(_message: string, _error: Error | LoggableError, meta?: LogMeta): void;

  /**
   * Add context to all future logs
   */
  addContext(_context: LogMeta): void;

  /**
   * Create a child logger with added context
   */
  child(_context: LogMeta): Logger;
}

/**
 * Base abstract logger implementation
 */
export abstract class BaseLogger implements Logger {
  protected _level: LogLevel = LogLevel.INFO;
  protected _context: LogMeta = {};

  constructor(level?: LogLevel, context?: LogMeta) {
    if (level !== undefined) this.level = level;
    if (context) this.context = { ...context };
  }

  public setLevel(_level: LogLevel): void {
    this.level = level;
  }

  public getLevel(): LogLevel {
    return this.level;
  }

  public addContext(_context: LogMeta): void {
    this.context = { ...this.context, ...context };
  }

  public child(_context: LogMeta): Logger {
    // Create a new instance with combined context
    const childLogger = this.createChildLogger();
    childLogger.addContext({ ...this.context, ...context });
    return childLogger;
  }

  protected abstract createChildLogger(): Logger;

  public trace(_message: string, meta?: LogMeta): void {
    if (this.level <= LogLevel.TRACE) {
      this.logMessage(LogLevel.TRACE, message, meta);
    }
  }

  public debug(_message: string, meta?: LogMeta): void {
    if (this.level <= LogLevel.DEBUG) {
      this.logMessage(LogLevel.DEBUG, message, meta);
    }
  }

  public info(_message: string, meta?: LogMeta): void {
    if (this.level <= LogLevel.INFO) {
      this.logMessage(LogLevel.INFO, message, meta);
    }
  }

  public warn(_message: string, meta?: LogMeta): void {
    if (this.level <= LogLevel.WARN) {
      this.logMessage(LogLevel.WARN, message, meta);
    }
  }

  public error(_message: string, errorOrMeta?: Error | LoggableError | LogMeta, meta?: LogMeta): void {
    if (this.level <= LogLevel.ERROR) {
      if (errorOrMeta instanceof Error) {
        this.logError(LogLevel.ERROR, message, errorOrMeta, meta);
      } else {
        this.logMessage(LogLevel.ERROR, message, errorOrMeta as LogMeta);
      }
    }
  }

  public fatal(_message: string, errorOrMeta?: Error | LoggableError | LogMeta, meta?: LogMeta): void {
    if (this.level <= LogLevel.FATAL) {
      if (errorOrMeta instanceof Error) {
        this.logError(LogLevel.FATAL, message, errorOrMeta, meta);
      } else {
        this.logMessage(LogLevel.FATAL, message, errorOrMeta as LogMeta);
      }
    }
  }

  protected abstract logMessage(_level: LogLevel, _message: string, meta?: LogMeta): void;
  protected abstract logError(_level: LogLevel, _message: string, _error: Error | LoggableError, meta?: LogMeta): void;
}

/**
 * Enhanced console logger with improved formatting
 */
export class ConsoleLogger extends BaseLogger {
  protected createChildLogger(): Logger {
    return new ConsoleLogger(this.level);
  }

  protected formatMeta(meta?: LogMeta): string {
    if (!meta || Object.keys(meta).length === 0) return '';
    try {
      return JSON.stringify(meta, null, process.env.NODE_ENV === 'development' ? _2 : 0);
    } catch (e) {
      return '[Unserializable metadata]';
    }
  }

  protected logMessage(_level: LogLevel, _message: string, meta?: LogMeta): void {
    const timestamp = new Date().toISOString();
    const combinedMeta = { ...this.context, ...meta, timestamp };
    const levelName = LogLevel[level];

    const formattedMeta = this.formatMeta(combinedMeta);
    const logFn = this.getConsoleMethod(level);

    logFn(`[${levelName}] ${message}`, formattedMeta ? `\n${formattedMeta}` : '');
  }

  protected logError(_level: LogLevel, _message: string, _error: Error | LoggableError, meta?: LogMeta): void {
    const _errorMeta: LogMeta = {
      _errorMessage: error.message,
      _stack: error.stack,
      ...(meta || {})
    };

    // Add custom error fields if available
    if ('code' in error && error.code) errorMeta.errorCode = error.code;
    if ('status' in error && error.status) errorMeta.status = error.status;
    if ('meta' in error && error.meta) errorMeta.errorMeta = error.meta;

    this.logMessage(level, message, errorMeta);
  }

  private getConsoleMethod(_level: LogLevel): (_message: string, ..._args: any[]) => void {
    switch (level) {
      case LogLevel._TRACE:
      case LogLevel._DEBUG:
        return console.debug;
      case LogLevel._INFO:
        return console.info;
      case LogLevel._WARN:
        return console.warn;
      case LogLevel._ERROR:
      case LogLevel._FATAL:
        return console.error;
      return console.log;
    }
  }
}

// Default export for convenience
export default new ConsoleLogger(process.env.NODE_ENV === 'production' ? LogLevel._INFO : LogLevel.DEBUG);
