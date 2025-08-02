import { AppError, ErrorCode, ErrorCategory } from '../../shared/types/errors';

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

export class AIError extends AppError {
  constructor(
    message: string,
    code: ErrorCode,
    category: ErrorCategory,
    retryable: boolean = false,
    retryAfter?: number,
    details?: Record<string, unknown>
  ) {
    super(message, category, code, details, undefined, retryable, retryAfter);
    this.name = 'AIError';
  }
}

export const AIServiceErrors = {
  INVALID_API_KEY: new AppError(
    'Invalid API key',
    ErrorCategory.AUTHENTICATION,
    ErrorCode.AUTHENTICATION_ERROR,
    { message: 'Please check your API key' },
    undefined,
    false
  ),
  RATE_LIMIT_EXCEEDED: new AppError(
    'Rate limit exceeded',
    ErrorCategory.SYSTEM,
    ErrorCode.RATE_LIMIT_EXCEEDED,
    { message: 'Too many requests. Please try again later' },
    undefined,
    true,
    60000
  ),
  MODEL_NOT_FOUND: new AppError(
    'Model not found',
    ErrorCategory.RESOURCE,
    ErrorCode.RESOURCE_NOT_FOUND,
    { message: 'The requested model is not available' },
    undefined,
    false
  ),
  INVALID_REQUEST: new AppError(
    'Invalid request',
    ErrorCategory.VALIDATION,
    ErrorCode.INVALID_REQUEST,
    { message: 'Please check your request parameters' },
    undefined,
    false
  ),
  API_ERROR: new AppError(
    'AI service error',
    ErrorCategory.SYSTEM,
    ErrorCode.INTERNAL_SERVER_ERROR,
    { message: 'Failed to process AI request. Please try again' },
    undefined,
    true,
    5000
  ),
  CACHE_ERROR: new AppError(
    'Cache error',
    ErrorCategory.SYSTEM,
    ErrorCode.INTERNAL_SERVER_ERROR,
    { message: 'Failed to access cache. Please try again' },
    undefined,
    true,
    5000
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
