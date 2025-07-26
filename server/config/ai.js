"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultAIServiceConfig = exports.AIServiceErrors = exports.AIError = void 0;
const errors_1 = require("../../shared/types/errors");
class AIError extends errors_1.AppError {
    constructor(message, code, category, retryable = false, retryAfter, details) {
        super(message, category, code, details, undefined, retryable, retryAfter);
        this.name = 'AIError';
    }
}
exports.AIError = AIError;
exports.AIServiceErrors = {
    INVALID_API_KEY: new errors_1.AppError('Invalid API key', errors_1.ErrorCategory.AUTHENTICATION, errors_1.ErrorCode.AUTHENTICATION_ERROR, { message: 'Please check your API key' }, undefined, false),
    RATE_LIMIT_EXCEEDED: new errors_1.AppError('Rate limit exceeded', errors_1.ErrorCategory.SYSTEM, errors_1.ErrorCode.RATE_LIMIT_EXCEEDED, { message: 'Too many requests. Please try again later' }, undefined, true, 60000),
    MODEL_NOT_FOUND: new errors_1.AppError('Model not found', errors_1.ErrorCategory.RESOURCE, errors_1.ErrorCode.RESOURCE_NOT_FOUND, { message: 'The requested model is not available' }, undefined, false),
    INVALID_REQUEST: new errors_1.AppError('Invalid request', errors_1.ErrorCategory.VALIDATION, errors_1.ErrorCode.INVALID_REQUEST, { message: 'Please check your request parameters' }, undefined, false),
    API_ERROR: new errors_1.AppError('AI service error', errors_1.ErrorCategory.SYSTEM, errors_1.ErrorCode.INTERNAL_SERVER_ERROR, { message: 'Failed to process AI request. Please try again' }, undefined, true, 5000),
    CACHE_ERROR: new errors_1.AppError('Cache error', errors_1.ErrorCategory.SYSTEM, errors_1.ErrorCode.INTERNAL_SERVER_ERROR, { message: 'Failed to access cache. Please try again' }, undefined, true, 5000)
};
exports.defaultAIServiceConfig = {
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
