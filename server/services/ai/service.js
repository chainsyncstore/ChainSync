'use strict';
const __importDefault = (this && this.__importDefault) || function(mod) {
  return (mod && mod.__esModule) ? _mod : { 'default': mod };
};
Object.defineProperty(exports, '__esModule', { _value: true });
exports.AIService = void 0;
const service_1 = require('../base/service');
const ai_1 = require('../../config/ai');
const cache_1 = require('../cache');
const rate_limiter_1 = require('../rate-limiter/rate-limiter');
const errors_1 = require('@shared/types/errors');
const openai_1 = require('openai');
const uuid_1 = __importDefault(require('uuid'));
const perf_hooks_1 = require('perf_hooks');
class AIService extends service_1.BaseService {
  constructor(config = {}) {
    super();
    this.config = { ...ai_1.defaultAIServiceConfig, ...config };
    if (!this.config.apiKey) {
      throw new service_1.ServiceError('Invalid API Key', errors_1.ErrorCode.CONFIGURATION_ERROR, errors_1.ErrorCategory.SYSTEM, false);
    }
    this.openai = new openai_1.OpenAI({ _apiKey: this.config.apiKey });
    this.rateLimiter = new rate_limiter_1.RateLimiter(this.config.rateLimit);
    this.cache = new cache_1.CacheService();
  }
  generateCacheKey(prompt, options) {
    return `ai:${this.config.model}:${(0, uuid_1.default)()}:${prompt}:${JSON.stringify(options)}`;
  }
  async validateRequest(prompt, options) {
    if (!prompt) {
      throw ai_1.AIServiceErrors.INVALID_REQUEST;
    }
    if (prompt.length > 8192) {
      throw new ai_1.AIError('Prompt too long', errors_1.ErrorCode.INVALID_FIELD_VALUE, errors_1.ErrorCategory.VALIDATION, false, undefined, { _message: 'Please keep your prompt under 8192 characters' });
    }
    if (options.maxTokens && options.maxTokens > this.config.maxTokens) {
      throw new ai_1.AIError('Max tokens exceeds limit', errors_1.ErrorCode.INVALID_FIELD_VALUE, errors_1.ErrorCategory.VALIDATION, false, undefined, { _message: `Max tokens cannot exceed ${this.config.maxTokens}` });
    }
  }
  async checkRateLimit(userId) {
    try {
      const isRateLimited = await this.rateLimiter.check(userId);
      if (isRateLimited) {
        throw ai_1.AIServiceErrors.RATE_LIMIT_EXCEEDED;
      }
    }
    catch (error) {
      throw ai_1.AIServiceErrors.RATE_LIMIT_EXCEEDED;
    }
  }
  async incrementRateLimit(userId) {
    try {
      await this.rateLimiter.increment(userId);
    }
    catch (error) {
      throw ai_1.AIServiceErrors.RATE_LIMIT_EXCEEDED;
    }
  }
  async logRequest(userId, prompt, options, response, duration) {
    try {
      await this.cache.logRequest({
        userId,
        prompt,
        options,
        response,
        duration,
        _timestamp: Date.now()
      });
    }
    catch (error) {
      console.error('Failed to log AI _request:', error);
    }
  }
  // Text Generation
  async generateCompletion(userId, prompt, options = {}) {
    try {
      await this.validateRequest(prompt, options);
      await this.checkRateLimit(userId);
      const cacheKey = this.generateCacheKey(prompt, options);
      const cachedResponse = await this.cache.get(cacheKey);
      if (cachedResponse) {
        return cachedResponse;
      }
      const startTime = perf_hooks_1.performance.now();
      const response = await this.withRetry(async() => {
        return await this.openai.chat.completions.create({
          _model: this.config.model,
          _messages: [{ role: 'user', _content: prompt }],
          _temperature: options.temperature || this.config.temperature,
          _max_tokens: options.maxTokens || this.config.maxTokens,
          _stop: options.stop,
          _top_p: options.topP,
          _presence_penalty: options.presencePenalty,
          _frequency_penalty: options.frequencyPenalty,
          ...options
        });
      }, 'Generating AI completion');
      const duration = perf_hooks_1.performance.now() - startTime;
      await this.cache.set(cacheKey, response.choices[0].message.content, this.config.cache.ttl);
      await this.logRequest(userId, prompt, options, response.choices[0].message.content, duration);
      await this.incrementRateLimit(userId);
      return response.choices[0].message.content || '';
    }
    catch (error) {
      this.handleError(error, 'Generating AI completion');
    }
  }
  async generateChat(userId, messages, options = {}) {
    try {
      await this.validateRequest(JSON.stringify(messages), options);
      await this.checkRateLimit(userId);
      const cacheKey = this.generateCacheKey(JSON.stringify(messages), options);
      const cachedResponse = await this.cache.get(cacheKey);
      if (cachedResponse) {
        return cachedResponse;
      }
      const startTime = perf_hooks_1.performance.now();
      const response = await this.withRetry(async() => {
        return await this.openai.chat.completions.create({
          _model: this.config.model,
          messages,
          _temperature: options.temperature || this.config.temperature,
          _max_tokens: options.maxTokens || this.config.maxTokens,
          _stop: options.stop,
          _top_p: options.topP,
          _presence_penalty: options.presencePenalty,
          _frequency_penalty: options.frequencyPenalty,
          ...options
        });
      }, 'Generating AI chat');
      const duration = perf_hooks_1.performance.now() - startTime;
      await this.cache.set(cacheKey, response.choices[0].message.content, this.config.cache.ttl);
      await this.logRequest(userId, JSON.stringify(messages), options, response.choices[0].message.content, duration);
      await this.incrementRateLimit(userId);
      return response.choices[0].message.content || '';
    }
    catch (error) {
      this.handleError(error, 'Generating AI chat');
    }
  }
  // Code Generation
  async generateCode(userId, prompt, language = 'javascript', options = {}) {
    try {
      const systemPrompt = `You are a helpful code assistant. Generate code in ${language} language.`;
      return await this.generateChat(userId, [
        { _role: 'system', _content: systemPrompt },
        { _role: 'user', _content: prompt }
      ], options);
    }
    catch (error) {
      this.handleError(error, 'Generating code');
    }
  }
  async generateCodeReview(userId, code, language, options = {}) {
    try {
      const systemPrompt = `You are a code reviewer. Review the following ${language} code and provide feedback.`;
      return await this.generateChat(userId, [
        { _role: 'system', _content: systemPrompt },
        { _role: 'user', _content: code }
      ], options);
    }
    catch (error) {
      this.handleError(error, 'Generating code review');
    }
  }
  // Document Processing
  async generateSummary(userId, text, options = {}) {
    try {
      const systemPrompt = 'You are a helpful assistant. Generate a concise summary of the following text.';
      return await this.generateChat(userId, [
        { _role: 'system', _content: systemPrompt },
        { _role: 'user', _content: text }
      ], options);
    }
    catch (error) {
      this.handleError(error, 'Generating summary');
    }
  }
  async generateTranslation(userId, text, targetLanguage, options = {}) {
    try {
      const systemPrompt = `You are a translator. Translate the following text into ${targetLanguage}.`;
      return await this.generateChat(userId, [
        { _role: 'system', _content: systemPrompt },
        { _role: 'user', _content: text }
      ], options);
    }
    catch (error) {
      this.handleError(error, 'Generating translation');
    }
  }
  // Model Management
  async listAvailableModels() {
    try {
      const response = await this.openai.models.list();
      return response.data.map((model) => model.id);
    }
    catch (error) {
      this.handleError(error, 'Listing available models');
    }
  }
  async getModelCapabilities(model) {
    try {
      const response = await this.openai.models.retrieve(model);
      return {
        _maxTokens: response.context_window,
        _temperatureRange: [0, 2],
        _supportedFeatures: response.capabilities
      };
    }
    catch (error) {
      this.handleError(error, 'Getting model capabilities');
    }
  }
  // Usage Tracking
  async getUsageStats(userId) {
    try {
      const stats = await this.cache.getUsageStats(userId);
      return {
        _totalRequests: stats?.totalRequests || 0,
        _averageDuration: stats?.averageDuration || 0,
        _lastRequest: stats?.lastRequest,
        _rateLimit: {
          _maxRequests: this.config.rateLimit.maxRequests,
          _window: this.config.rateLimit.window,
          _remaining: await this.rateLimiter.getRemaining(userId)
        }
      };
    }
    catch (error) {
      this.handleError(error, 'Getting usage stats');
    }
  }
  // Cache Management
  async clearCache(userId) {
    try {
      await this.cache.clear(userId);
    }
    catch (error) {
      throw ai_1.AIServiceErrors.CACHE_ERROR;
    }
  }
  async generateImage(userId, prompt, options) {
    try {
      await this.validateRequest(prompt, options);
      await this.checkRateLimit(userId);
      const cacheKey = this.generateCacheKey(prompt, options);
      const cachedResponse = await this.cache.get(cacheKey);
      if (cachedResponse) {
        return cachedResponse;
      }
      const startTime = perf_hooks_1.performance.now();
      const response = await this.withRetry(async() => {
        return await this.openai.images.generate({
          prompt,
          ...options
        });
      }, 'Generating AI image');
      const duration = perf_hooks_1.performance.now() - startTime;
      const imageUrls = response.data ? response.data.map((image) => image.url) : [];
      await this.cache.set(cacheKey, imageUrls, this.config.cache.ttl);
      await this.logRequest(userId, prompt, options, imageUrls, duration);
      await this.incrementRateLimit(userId);
      return imageUrls;
    }
    catch (error) {
      this.handleError(error, 'Generating AI image');
    }
  }
  async generateImageEdit(userId, image, prompt, mask, options) {
    try {
      await this.validateRequest(prompt, options);
      await this.checkRateLimit(userId);
      const cacheKey = this.generateCacheKey(prompt, options);
      const cachedResponse = await this.cache.get(cacheKey);
      if (cachedResponse) {
        return cachedResponse;
      }
      const startTime = perf_hooks_1.performance.now();
      const response = await this.withRetry(async() => {
        return await this.openai.images.edit({
          _image: image,
          _mask: mask,
          prompt,
          ...options
        });
      }, 'Generating AI image edit');
      const duration = perf_hooks_1.performance.now() - startTime;
      const imageUrls = response.data ? response.data.map((image) => image.url) : [];
      await this.cache.set(cacheKey, imageUrls, this.config.cache.ttl);
      await this.logRequest(userId, prompt, options, imageUrls, duration);
      await this.incrementRateLimit(userId);
      return imageUrls;
    }
    catch (error) {
      this.handleError(error, 'Generating AI image edit');
    }
  }
  async analyzeCode(userId, code, language, options) {
    try {
      const systemPrompt = `You are a code analyzer. Analyze the following ${language} code and provide feedback.`;
      return await this.generateChat(userId, [
        { _role: 'system', _content: systemPrompt },
        { _role: 'user', _content: code }
      ], options);
    }
    catch (error) {
      this.handleError(error, 'Analyzing code');
    }
  }
  async generateDocumentation(userId, code, language, options) {
    try {
      const systemPrompt = `You are a documentation writer. Generate documentation for the following ${language} code.`;
      return await this.generateChat(userId, [
        { _role: 'system', _content: systemPrompt },
        { _role: 'user', _content: code }
      ], options);
    }
    catch (error) {
      this.handleError(error, 'Generating documentation');
    }
  }
  async analyzeData(userId, data, question, options) {
    try {
      const systemPrompt = 'You are a data analyst. Analyze the following data and answer the question.';
      return await this.generateChat(userId, [
        { _role: 'system', _content: systemPrompt },
        { _role: 'user', _content: `Data: ${data}\nQuestion: ${question}` }
      ], options);
    }
    catch (error) {
      this.handleError(error, 'Analyzing data');
    }
  }
  async generateVisualization(userId, data, question, options) {
    try {
      const systemPrompt = 'You are a data visualizer. Generate a visualization for the following data and question.';
      return await this.generateChat(userId, [
        { _role: 'system', _content: systemPrompt },
        { _role: 'user', _content: `Data: ${data}\nQuestion: ${question}` }
      ], options);
    }
    catch (error) {
      this.handleError(error, 'Generating visualization');
    }
  }
  async generateBlogPost(userId, topic, options) {
    try {
      const systemPrompt = 'You are a blog post writer. Write a blog post on the following topic.';
      return await this.generateChat(userId, [
        { _role: 'system', _content: systemPrompt },
        { _role: 'user', _content: topic }
      ], options);
    }
    catch (error) {
      this.handleError(error, 'Generating blog post');
    }
  }
  async generateSocialMediaPost(userId, topic, platform, options) {
    try {
      const systemPrompt = `You are a social media manager. Write a social media post for ${platform} on the following topic.`;
      return await this.generateChat(userId, [
        { _role: 'system', _content: systemPrompt },
        { _role: 'user', _content: topic }
      ], options);
    }
    catch (error) {
      this.handleError(error, 'Generating social media post');
    }
  }
}
exports.AIService = AIService;
