import { AppError, ErrorCode, ErrorCategory } from '@shared/types/errors';

export interface AIServiceConfig {
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  rateLimit: {
    window: number; // in seconds
    maxRequests: number;
  };
  cache: {
    enabled: boolean;
    ttl: number; // in seconds
    maxEntries: number;
  };
}

export interface AIError extends AppError {
  code: ErrorCode;
  category: ErrorCategory;
  retryable?: boolean;
  retryDelay?: number;
  context?: any;
}

export const AIServiceErrors = {
  INVALID_API_KEY: new AppError(
    'Invalid API key',
    ErrorCode.AUTHENTICATION_ERROR,
    ErrorCategory.AUTHENTICATION,
    false,
    undefined,
    'Please check your API key'
  ),
  RATE_LIMIT_EXCEEDED: new AppError(
    'Rate limit exceeded',
    ErrorCode.RATE_LIMIT_EXCEEDED,
    ErrorCategory.SYSTEM,
    true,
    60000, // 1 minute retry
    'Too many requests. Please try again later'
  ),
  MODEL_NOT_FOUND: new AppError(
    'Model not found',
    ErrorCode.RESOURCE_NOT_FOUND,
    ErrorCategory.RESOURCE,
    false,
    undefined,
    'The requested model is not available'
  ),
  INVALID_REQUEST: new AppError(
    'Invalid request',
    ErrorCode.INVALID_REQUEST,
    ErrorCategory.VALIDATION,
    false,
    undefined,
    'Please check your request parameters'
  ),
  API_ERROR: new AppError(
    'AI service error',
    ErrorCode.INTERNAL_SERVER_ERROR,
    ErrorCategory.SYSTEM,
    true,
    5000,
    'Failed to process AI request. Please try again'
  ),
  CACHE_ERROR: new AppError(
    'Cache error',
    ErrorCode.INTERNAL_SERVER_ERROR,
    ErrorCategory.SYSTEM,
    true,
    5000,
    'Failed to access cache. Please try again'
  )
};

export const defaultAIServiceConfig: AIServiceConfig = {
  apiKey: process.env.AI_API_KEY || '',
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 2000,
  rateLimit: {
    window: 60, // 1 minute
    maxRequests: 60
  },
  cache: {
    enabled: true,
    ttl: 300, // 5 minutes
    maxEntries: 1000
  }
};
