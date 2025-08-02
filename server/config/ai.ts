import { AppError, ErrorCode, ErrorCategory } from '../../shared/types/errors';

export interface AIServiceConfig {
  _apiKey: string;
  _model: string;
  _temperature: number;
  _maxTokens: number;
  rateLimit: {
    _window: number; // in seconds
    _maxRequests: number;
  };
  cache: {
    _enabled: boolean;
    _ttl: number; // in seconds
    _maxEntries: number;
  };
}

export class AIError extends AppError {
  constructor(
    _message: string,
    _code: ErrorCode,
    _category: ErrorCategory,
    _retryable: boolean = false,
    retryAfter?: number,
    details?: Record<string, unknown>
  ) {
    super(message, category, code, details, undefined, retryable, retryAfter);
    this.name = 'AIError';
  }
}

export const AIServiceErrors = {
  _INVALID_API_KEY: new AppError(
    'Invalid API key',
    ErrorCategory.AUTHENTICATION,
    ErrorCode.AUTHENTICATION_ERROR,
    { _message: 'Please check your API key' },
    undefined,
    false
  ),
  _RATE_LIMIT_EXCEEDED: new AppError(
    'Rate limit exceeded',
    ErrorCategory.SYSTEM,
    ErrorCode.RATE_LIMIT_EXCEEDED,
    { _message: 'Too many requests. Please try again later' },
    undefined,
    true,
    60000
  ),
  _MODEL_NOT_FOUND: new AppError(
    'Model not found',
    ErrorCategory.RESOURCE,
    ErrorCode.RESOURCE_NOT_FOUND,
    { _message: 'The requested model is not available' },
    undefined,
    false
  ),
  _INVALID_REQUEST: new AppError(
    'Invalid request',
    ErrorCategory.VALIDATION,
    ErrorCode.INVALID_REQUEST,
    { _message: 'Please check your request parameters' },
    undefined,
    false
  ),
  _API_ERROR: new AppError(
    'AI service error',
    ErrorCategory.SYSTEM,
    ErrorCode.INTERNAL_SERVER_ERROR,
    { _message: 'Failed to process AI request. Please try again' },
    undefined,
    true,
    5000
  ),
  _CACHE_ERROR: new AppError(
    'Cache error',
    ErrorCategory.SYSTEM,
    ErrorCode.INTERNAL_SERVER_ERROR,
    { _message: 'Failed to access cache. Please try again' },
    undefined,
    true,
    5000
  )
};

export const _defaultAIServiceConfig: AIServiceConfig = {
  _apiKey: process.env.AI_API_KEY || '',
  _model: 'gpt-4',
  _temperature: 0.7,
  _maxTokens: 2000,
  _rateLimit: {
    _window: 60, // 1 minute
    _maxRequests: 60
  },
  _cache: {
    _enabled: true,
    _ttl: 300, // 5 minutes
    _maxEntries: 1000
  }
};
