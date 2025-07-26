"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultAnalyticsConfig = exports.AnalyticsServiceErrors = void 0;
const errors_1 = require("@shared/types/errors");
exports.AnalyticsServiceErrors = {
    INVALID_QUERY: new errors_1.AppError('Invalid analytics query', errors_1.ErrorCategory.VALIDATION, errors_1.ErrorCode.INVALID_REQUEST, { details: 'Please check your query parameters' }, 400, false),
    CACHE_ERROR: new errors_1.AppError('Cache error', errors_1.ErrorCategory.SYSTEM, errors_1.ErrorCode.INTERNAL_SERVER_ERROR, { details: 'Failed to access cache. Please try again' }, 500, true, 5000),
    STORAGE_ERROR: new errors_1.AppError('Storage error', errors_1.ErrorCategory.SYSTEM, errors_1.ErrorCode.INTERNAL_SERVER_ERROR, { details: 'Failed to access storage. Please try again' }, 500, true, 5000),
    AGGREGATION_ERROR: new errors_1.AppError('Aggregation error', errors_1.ErrorCategory.SYSTEM, errors_1.ErrorCode.INTERNAL_SERVER_ERROR, { details: 'Failed to aggregate data. Please try again' }, 500, true, 5000),
    QUERY_TIMEOUT: new errors_1.AppError('Query timeout', errors_1.ErrorCategory.SYSTEM, errors_1.ErrorCode.REQUEST_TIMEOUT, { details: 'Query took too long to complete. Please try again' }, 408, true, 10000)
};
exports.defaultAnalyticsConfig = {
    cache: {
        enabled: true,
        ttl: 300, // 5 minutes
        maxEntries: 1000
    },
    aggregation: {
        window: 60, // 1 minute
        batchSize: 1000
    },
    storage: {
        type: 'redis',
        connection: process.env.REDIS_URL || 'redis://localhost:6379'
    }
};
