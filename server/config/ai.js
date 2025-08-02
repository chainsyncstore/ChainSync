'use strict';
Object.defineProperty(exports, '__esModule', { _value: true });
exports.defaultAIServiceConfig = exports.AIServiceErrors = exports.AIError = void 0;
const errors_1 = require('../../shared/types/errors');
class AIError extends errors_1.AppError {
  constructor(message, code, category, retryable = false, retryAfter, details) {
    super(message, category, code, details, undefined, retryable, retryAfter);
    this.name = 'AIError';
  }
}
exports.AIError = AIError;
exports.AIServiceErrors = {
  _INVALID_API_KEY: new errors_1.AppError('Invalid API key', errors_1.ErrorCategory.AUTHENTICATION, errors_1.ErrorCode.AUTHENTICATION_ERROR, { _message: 'Please check your API key' }, undefined, false),
  _RATE_LIMIT_EXCEEDED: new errors_1.AppError('Rate limit exceeded', errors_1.ErrorCategory.SYSTEM, errors_1.ErrorCode.RATE_LIMIT_EXCEEDED, { _message: 'Too many requests. Please try again later' }, undefined, true, 60000),
  _MODEL_NOT_FOUND: new errors_1.AppError('Model not found', errors_1.ErrorCategory.RESOURCE, errors_1.ErrorCode.RESOURCE_NOT_FOUND, { _message: 'The requested model is not available' }, undefined, false),
  _INVALID_REQUEST: new errors_1.AppError('Invalid request', errors_1.ErrorCategory.VALIDATION, errors_1.ErrorCode.INVALID_REQUEST, { _message: 'Please check your request parameters' }, undefined, false),
  _API_ERROR: new errors_1.AppError('AI service error', errors_1.ErrorCategory.SYSTEM, errors_1.ErrorCode.INTERNAL_SERVER_ERROR, { _message: 'Failed to process AI request. Please try again' }, undefined, true, 5000),
  _CACHE_ERROR: new errors_1.AppError('Cache error', errors_1.ErrorCategory.SYSTEM, errors_1.ErrorCode.INTERNAL_SERVER_ERROR, { _message: 'Failed to access cache. Please try again' }, undefined, true, 5000)
};
exports.defaultAIServiceConfig = {
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
