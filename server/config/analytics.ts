import { AppError, ErrorCode, ErrorCategory } from '@shared/types/errors';

export interface AnalyticsConfig {
  cache: {
    enabled: boolean;
    ttl: number; // in seconds
    maxEntries: number;
  };
  aggregation: {
    window: number; // in seconds
    batchSize: number;
  };
  storage: {
    type: 'in-memory' | 'redis';
    connection: string;
  };
}

export interface AnalyticsError extends AppError {
  code: ErrorCode;
  category: ErrorCategory;
  retryable?: boolean;
  retryDelay?: number;
  context?: unknown;
}

export const AnalyticsServiceErrors = {
  INVALID_QUERY: new AppError(
    'Invalid analytics query',
    ErrorCategory.VALIDATION,
    ErrorCode.INVALID_REQUEST,
    { contextMessage: 'Please check your query parameters' },
    undefined, // statusCode
    false // retryable
  ),
  CACHE_ERROR: new AppError(
    'Cache error',
    ErrorCategory.SYSTEM,
    ErrorCode.INTERNAL_SERVER_ERROR,
    { contextMessage: 'Failed to access cache. Please try again' },
    undefined, // statusCode
    true, // retryable
    5000 // retryAfter
  ),
  STORAGE_ERROR: new AppError(
    'Storage error',
    ErrorCategory.SYSTEM,
    ErrorCode.INTERNAL_SERVER_ERROR,
    { contextMessage: 'Failed to access storage. Please try again' },
    undefined, // statusCode
    true, // retryable
    5000 // retryAfter
  ),
  AGGREGATION_ERROR: new AppError(
    'Aggregation error',
    ErrorCategory.SYSTEM,
    ErrorCode.INTERNAL_SERVER_ERROR,
    { contextMessage: 'Failed to aggregate data. Please try again' },
    undefined, // statusCode
    true, // retryable
    5000 // retryAfter
  ),
  QUERY_TIMEOUT: new AppError(
    'Query timeout',
    ErrorCategory.SYSTEM,
    ErrorCode.REQUEST_TIMEOUT,
    { contextMessage: 'Query took too long to complete. Please try again' },
    undefined, // statusCode
    true, // retryable
    10000 // retryAfter
  ),
};

export const defaultAnalyticsConfig: AnalyticsConfig = {
  cache: {
    enabled: true,
    ttl: 300, // 5 minutes
    maxEntries: 1000,
  },
  aggregation: {
    window: 60, // 1 minute
    batchSize: 1000,
  },
  storage: {
    type: 'redis',
    connection: process.env.REDIS_URL || 'redis://localhost:6379',
  },
};
