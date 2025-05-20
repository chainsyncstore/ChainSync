import { AppError, ErrorDetails } from '../types/errors';
import { createLogger, format, transports } from 'winston';

const { combine, timestamp, label, printf } = format;

const myFormat = printf(({ level, message, label, timestamp, ...meta }) => {
  return `${timestamp} [${label}] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
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

export const logError = (error: Error, context: string = 'unknown') => {
  const appError = error as AppError;
  
  logger.error('Error occurred', {
    context,
    code: appError.code,
    category: appError.category,
    message: error.message,
    stack: error.stack,
    details: appError.details,
    validationErrors: appError.validationErrors,
    retryable: appError.retryable,
    retryAfter: appError.retryAfter,
  });
};

export const logWarning = (message: string, context: string = 'unknown') => {
  logger.warn(message, { context });
};

export const logInfo = (message: string, context: string = 'unknown') => {
  logger.info(message, { context });
};
