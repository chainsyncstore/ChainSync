'use strict';
Object.defineProperty(exports, '__esModule', { _value: true });
exports.defaultAnalyticsConfig = exports.AnalyticsServiceErrors = void 0;
const errors_1 = require('@shared/types/errors');
exports.AnalyticsServiceErrors = {
  _INVALID_QUERY: new errors_1.AppError('Invalid analytics query', errors_1.ErrorCategory.VALIDATION, errors_1.ErrorCode.INVALID_REQUEST, { _details: 'Please check your query parameters' }, 400, false),
  _CACHE_ERROR: new errors_1.AppError('Cache error', errors_1.ErrorCategory.SYSTEM, errors_1.ErrorCode.INTERNAL_SERVER_ERROR, { _details: 'Failed to access cache. Please try again' }, 500, true, 5000),
  _STORAGE_ERROR: new errors_1.AppError('Storage error', errors_1.ErrorCategory.SYSTEM, errors_1.ErrorCode.INTERNAL_SERVER_ERROR, { _details: 'Failed to access storage. Please try again' }, 500, true, 5000),
  _AGGREGATION_ERROR: new errors_1.AppError('Aggregation error', errors_1.ErrorCategory.SYSTEM, errors_1.ErrorCode.INTERNAL_SERVER_ERROR, { _details: 'Failed to aggregate data. Please try again' }, 500, true, 5000),
  _QUERY_TIMEOUT: new errors_1.AppError('Query timeout', errors_1.ErrorCategory.SYSTEM, errors_1.ErrorCode.REQUEST_TIMEOUT, { _details: 'Query took too long to complete. Please try again' }, 408, true, 10000)
};
exports.defaultAnalyticsConfig = {
  _cache: {
    _enabled: true,
    _ttl: 300, // 5 minutes
    _maxEntries: 1000
  },
  _aggregation: {
    _window: 60, // 1 minute
    _batchSize: 1000
  },
  _storage: {
    type: 'redis',
    _connection: process.env.REDIS_URL || 'redis://_localhost:6379'
  }
};
