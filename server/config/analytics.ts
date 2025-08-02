import { AppError, ErrorCode, ErrorCategory } from '@shared/types/errors';

export interface AnalyticsConfig {
  _cache: {
    _enabled: boolean;
    _ttl: number; // in seconds
    _maxEntries: number;
  };
  aggregation: {
    _window: number; // in seconds
    _batchSize: number;
  };
  storage: {
    type: 'in-memory' | 'redis';
    _connection: string;
  };
}

export interface AnalyticsError extends AppError {
  _code: ErrorCode;
  _category: ErrorCategory;
  retryable?: boolean;
  retryDelay?: number;
  context?: any;
}

export const AnalyticsServiceErrors = {
  _INVALID_QUERY: new AppError(
    'Invalid analytics query',
    ErrorCategory.VALIDATION,
    ErrorCode.INVALID_REQUEST,
    { _details: 'Please check your query parameters' },
    400,
    false
  ),
  _CACHE_ERROR: new AppError(
    'Cache error',
    ErrorCategory.SYSTEM,
    ErrorCode.INTERNAL_SERVER_ERROR,
    { _details: 'Failed to access cache. Please try again' },
    500,
    true,
    5000
  ),
  _STORAGE_ERROR: new AppError(
    'Storage error',
    ErrorCategory.SYSTEM,
    ErrorCode.INTERNAL_SERVER_ERROR,
    { _details: 'Failed to access storage. Please try again' },
    500,
    true,
    5000
  ),
  _AGGREGATION_ERROR: new AppError(
    'Aggregation error',
    ErrorCategory.SYSTEM,
    ErrorCode.INTERNAL_SERVER_ERROR,
    { _details: 'Failed to aggregate data. Please try again' },
    500,
    true,
    5000
  ),
  _QUERY_TIMEOUT: new AppError(
    'Query timeout',
    ErrorCategory.SYSTEM,
    ErrorCode.REQUEST_TIMEOUT,
    { _details: 'Query took too long to complete. Please try again' },
    408,
    true,
    10000
  )
};

export const _defaultAnalyticsConfig: AnalyticsConfig = {
  cache: {
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
