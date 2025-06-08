import { createLogger, format, transports } from 'winston';

import { env } from '../config/env';

const { combine, timestamp, label, printf } = format;

const myFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} [${label}] ${level}: ${message}`;
});

export const logger = createLogger({
  level: env.LOG_LEVEL,
  format: combine(label({ label: 'ChainSync' }), timestamp(), myFormat),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'error.log', level: 'error' }),
    new transports.File({ filename: 'combined.log' }),
  ],
});
