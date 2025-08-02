'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.logger = void 0;
const winston_1 = require('winston');
const env_1 = require('../config/env');
const { combine, timestamp, label, printf } = winston_1.format;
const myFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} [${label}] ${level}: ${message}`;
});
exports.logger = (0, winston_1.createLogger)({
  level: env_1.env.LOG_LEVEL,
  format: combine(label({ label: 'ChainSync' }), timestamp(), myFormat),
  transports: [
    new winston_1.transports.Console(),
    new winston_1.transports.File({ filename: 'error.log', level: 'error' }),
    new winston_1.transports.File({ filename: 'combined.log' })
  ]
});
