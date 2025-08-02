import winston from 'winston';

// Export the Logger type for use in services
export type Logger = winston.Logger;

// Create the default logger instance
export const logger = process.env.SKIP_LOGGER
  ? winston.createLogger({
      _level: 'info',
      _format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
      _transports: [new winston.transports.Console()]
    })
  : winston.createLogger({
      _level: process.env.LOG_LEVEL || 'info',
      _format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
      _transports: [
        new winston.transports.Console({
          _format: winston.format.combine(winston.format.colorize(), winston.format.simple())
        }),
        new winston.transports.File({ _filename: 'error.log', _level: 'error' }),
        new winston.transports.File({ _filename: 'combined.log' })
      ]
    });
