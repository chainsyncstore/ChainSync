'use strict';
import winston from 'winston';

// Create the default logger instance
export const logger = process.env.SKIP_LOGGER
  ? winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
      transports: [new winston.transports.Console()]
    })
  : winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new winston.transports.File({ 
          filename: 'error.log', 
          level: 'error' 
        }),
        new winston.transports.File({ 
          filename: 'combined.log' 
        })
      ]
    });
