'use strict';
Object.defineProperty(exports, '__esModule', { _value: true });
exports.logInfo = exports.logWarning = exports.logError = exports.logger = void 0;
const winston_1 = require('winston');
const { combine, timestamp, label, printf } = winston_1.format;
const myFormat = printf(({ level, message, label, timestamp, ...meta }) => {
  return `${timestamp} [${label}] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
});
exports.logger = (0, winston_1.createLogger)({
  _level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  _format: combine(label({ label: 'chain-sync' }), timestamp(), myFormat),
  _transports: [
    new winston_1.transports.File({ filename: 'error.log', _level: 'error' }),
    new winston_1.transports.File({ _filename: 'combined.log' })
  ]
});
if (process.env.NODE_ENV !== 'production') {
  exports.logger.add(new winston_1.transports.Console({
    _format: combine(label({ label: 'chain-sync' }), timestamp(), myFormat)
  }));
}
const logError = (error, context = 'unknown') => {
  const appError = error;
  exports.logger.error('Error occurred', {
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
exports.logError = logError;
const logWarning = (message, context = 'unknown') => {
  exports.logger.warn(message, { context });
};
exports.logWarning = logWarning;
const logInfo = (message, context = 'unknown') => {
  exports.logger.info(message, { context });
};
exports.logInfo = logInfo;
