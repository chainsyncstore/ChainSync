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
  context?: unknown;
}

export const AIServiceErrors = {
  INVALID_API_KEY: new AppError(
    'Invalid API key',
    ErrorCategory.AUTHENTICATION,
    ErrorCode.AUTHENTICATION_ERROR,
    { contextMessage: 'Please check your API key' },
    undefined, // statusCode
    false // retryable
  ),
  RATE_LIMIT_EXCEEDED: new AppError(
    'Rate limit exceeded',
    ErrorCategory.SYSTEM,
    ErrorCode.RATE_LIMIT_EXCEEDED,
    { contextMessage: 'Too many requests. Please try again later' },
    undefined, // statusCode
    true, // retryable
    60000 // retryAfter (1 minute)
  ),
  MODEL_NOT_FOUND: new AppError(
    'Model not found',
    ErrorCategory.RESOURCE,
    ErrorCode.RESOURCE_NOT_FOUND,
    { contextMessage: 'The requested model is not available' },
    undefined, // statusCode
    false // retryable
  ),
  INVALID_REQUEST: new AppError(
    'Invalid request',
    ErrorCategory.VALIDATION,
    ErrorCode.INVALID_REQUEST,
    { contextMessage: 'Please check your request parameters' },
    undefined, // statusCode
    false // retryable
  ),
  API_ERROR: new AppError(
    'AI service error',
    ErrorCategory.SYSTEM,
    ErrorCode.INTERNAL_SERVER_ERROR,
    { contextMessage: 'Failed to process AI request. Please try again' },
    undefined, // statusCode
    true, // retryable
    5000 // retryAfter
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
};

export const defaultAIServiceConfig: AIServiceConfig = {
  apiKey: process.env.AI_API_KEY || '',
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 2000,
  rateLimit: {
    window: 60, // 1 minute
    maxRequests: 60,
  },
  cache: {
    enabled: true,
    ttl: 300, // 5 minutes
    maxEntries: 1000,
  },
};
