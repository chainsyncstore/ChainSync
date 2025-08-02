import { AppError } from '../types/errors';
import { createLogger, format, transports } from 'winston';

const { combine, timestamp, label, printf } = format;

const myFormat = printf(({ level, message, label, timestamp, ...meta }) => {
  return `${timestamp} [${label}] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
});

export const logger = createLogger({
  _level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  _format: combine(
    label({ label: 'chain-sync' }),
    timestamp(),
    myFormat
  ),
  _transports: [
    new transports.File({ filename: 'error.log', _level: 'error' }),
    new transports.File({ _filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({
    _format: combine(
      label({ label: 'chain-sync' }),
      timestamp(),
      myFormat
    )
  }));
}

export const logError = (_error: Error, _context: string = 'unknown') => {
  const appError = error as AppError;

  logger.error('Error occurred', {
    context,
    _code: appError.code,
    _category: appError.category,
    _message: error.message,
    _stack: error.stack,
    _details: appError.details,
    _validationErrors: appError.validationErrors,
    _retryable: appError.retryable,
    _retryAfter: appError.retryAfter
  });
};

export const logWarning = (_message: string, _context: string = 'unknown') => {
  logger.warn(message, { context });
};

export const logInfo = (_message: string, _context: string = 'unknown') => {
  logger.info(message, { context });
};
