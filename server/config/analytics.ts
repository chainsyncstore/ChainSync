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
  context?: any;
}

export const AnalyticsServiceErrors = {
  INVALID_QUERY: new AppError(
    'Invalid analytics query',
    ErrorCode.INVALID_REQUEST,
    ErrorCategory.VALIDATION,
    false,
    undefined,
    'Please check your query parameters'
  ),
  CACHE_ERROR: new AppError(
    'Cache error',
    ErrorCode.INTERNAL_SERVER_ERROR,
    ErrorCategory.SYSTEM,
    true,
    5000,
    'Failed to access cache. Please try again'
  ),
  STORAGE_ERROR: new AppError(
    'Storage error',
    ErrorCode.INTERNAL_SERVER_ERROR,
    ErrorCategory.SYSTEM,
    true,
    5000,
    'Failed to access storage. Please try again'
  ),
  AGGREGATION_ERROR: new AppError(
    'Aggregation error',
    ErrorCode.INTERNAL_SERVER_ERROR,
    ErrorCategory.SYSTEM,
    true,
    5000,
    'Failed to aggregate data. Please try again'
  ),
  QUERY_TIMEOUT: new AppError(
    'Query timeout',
    ErrorCode.REQUEST_TIMEOUT,
    ErrorCategory.SYSTEM,
    true,
    10000,
    'Query took too long to complete. Please try again'
  )
};

export const defaultAnalyticsConfig: AnalyticsConfig = {
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
