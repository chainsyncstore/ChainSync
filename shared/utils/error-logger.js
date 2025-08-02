'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.logInfo = exports.logWarning = exports.logError = exports.logger = void 0;
const winston_1 = require('winston');
const { combine, timestamp, label, printf } = winston_1.format;
const myFormat = printf(({ level, message, label, timestamp, ...meta }) => {
  return `${timestamp} [${label}] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
});
exports.logger = (0, winston_1.createLogger)({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: combine(label({ label: 'chain-sync' }), timestamp(), myFormat),
  transports: [
    new winston_1.transports.File({ filename: 'error.log', level: 'error' }),
    new winston_1.transports.File({ filename: 'combined.log' })
  ]
});
if (process.env.NODE_ENV !== 'production') {
  exports.logger.add(new winston_1.transports.Console({
    format: combine(label({ label: 'chain-sync' }), timestamp(), myFormat)
  }));
}
const logError = (error, context = 'unknown') => {
  const appError = error;
  exports.logger.error('Error occurred', {
    context,
    code: appError.code,
    category: appError.category,
    message: error.message,
    stack: error.stack,
    details: appError.details,
    validationErrors: appError.validationErrors,
    retryable: appError.retryable,
    retryAfter: appError.retryAfter
  });
};
exports.logError = logError;
const logWarning = (message, context = 'unknown') => {
  exports.logger.warn(message, { context });
};
exports.logWarning = logWarning;
const logInfo = (message, context = 'unknown') => {
  exports.logger.info(message, { context });
};
exports.logInfo = logInfo;
