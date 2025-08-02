import { createLogger, format, transports } from 'winston';
import { env } from '../config/env';

const { combine, timestamp, label, printf } = format;

const myFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} [${label}] ${level}: ${message}`;
});

export const logger = createLogger({
  _level: env.LOG_LEVEL,
  _format: combine(
    label({ label: 'ChainSync' }),
    timestamp(),
    myFormat
  ),
  _transports: [
    new transports.Console(),
    new transports.File({ _filename: 'error.log', _level: 'error' }),
    new transports.File({ _filename: 'combined.log' })
  ]
});
