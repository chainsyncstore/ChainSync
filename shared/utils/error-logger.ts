import { AppError } from '@shared/types/errors';
import { createLogger, format, transports, Logform } from 'winston';

const { combine, timestamp, label, printf } = format;

const myFormat = printf(({ level, message, label: logLabel, timestamp: ts, ...meta }: Logform.TransformableInfo) => {
  // Ensure meta is an object before trying to get its keys or stringify
  const metaString = meta && Object.keys(meta).length ? JSON.stringify(meta) : '';
  return `${ts} [${logLabel}] ${level}: ${message} ${metaString}`;
});

export const logger = createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: combine(
    label({ label: 'chain-sync' }),
    timestamp(),
    myFormat
  ),
  transports: [
    new transports.File({ filename: 'error.log', level: 'error' }),
    new transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({
    format: combine(
      label({ label: 'chain-sync' }),
      timestamp(),
      myFormat
    ),
  }));
}

interface LogEntryType {
  context: string;
  message: string;
  stack?: string;
  code?: string; // From AppError or generic
  category?: string; // From AppError or generic
  details?: Record<string, unknown> | unknown[]; // AppError.details or AppError.validationErrors
  validationErrors?: unknown[]; // Specifically for AppError.validationErrors
  retryable?: boolean; // From AppError
  retryAfter?: number; // From AppError
  // Add any other fields that might be logged
}

export const logError = (error: Error, context: string = 'unknown') => {
  const logEntry: LogEntryType = {
    context,
    message: error.message,
    stack: error.stack,
  };

  if (error instanceof AppError) {
    logEntry.code = error.code;
    logEntry.category = error.category;
    // Prefer to assign validationErrors to its own field if it exists, otherwise use details
    if (error.validationErrors && error.validationErrors.length > 0) {
      logEntry.validationErrors = error.validationErrors;
    } else {
      logEntry.details = error.details;
    }
    logEntry.retryable = error.retryable;
    logEntry.retryAfter = error.retryAfter;
  } else {
    // For generic errors, you might want to add a generic error code/category
    logEntry.code = 'UNHANDLED_ERROR';
    logEntry.category = 'SYSTEM';
  }
  
  logger.error('Error occurred', logEntry);
};

export const logWarning = (message: string, context: string = 'unknown') => {
  logger.warn(message, { context });
};

export const logInfo = (message: string, context: string = 'unknown') => {
  logger.info(message, { context });
};
