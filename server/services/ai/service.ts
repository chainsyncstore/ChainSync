import { BaseService, ServiceError } from '../base/service';
import { AIServiceConfig, AIServiceErrors, AIError, defaultAIServiceConfig } from '../../config/ai';
import { CacheService } from '../cache';
import { RateLimiter } from '../rate-limiter/rate-limiter';
import { ErrorCode, ErrorCategory } from '@shared/types/errors';
import { OpenAI } from 'openai';
import uuidv4 from 'uuid';
import { performance } from 'perf_hooks';
import { AIService as IAIService } from './types';

export class AIService extends BaseService implements IAIService {
  private _openai: OpenAI;
  private _rateLimiter: RateLimiter;
  private _cache: CacheService;
  private _config: AIServiceConfig;

  constructor(_config: Partial<AIServiceConfig> = {}) {
    super();
    this.config = { ...defaultAIServiceConfig, ...config };

    if (!this.config.apiKey) {
      throw new ServiceError(
        'Invalid API Key',
        ErrorCode.CONFIGURATION_ERROR,
        ErrorCategory.SYSTEM,
        false
      );
    }

    this.openai = new OpenAI({ _apiKey: this.config.apiKey });
    this.rateLimiter = new RateLimiter(this.config.rateLimit);
    this.cache = new CacheService();
  }

  private generateCacheKey(_prompt: string, _options: any): string {
    return `ai:${this.config.model}:${uuidv4()}:${prompt}:${JSON.stringify(options)}`;
  }

  private async validateRequest(_prompt: string, _options: any): Promise<void> {
    if (!prompt) {
      throw AIServiceErrors.INVALID_REQUEST;
    }

    if (prompt.length > 8192) {
      throw new AIError(
        'Prompt too long',
        ErrorCode.INVALID_FIELD_VALUE,
        ErrorCategory.VALIDATION,
        false,
        undefined,
        { _message: 'Please keep your prompt under 8192 characters' }
      );
    }

    if (options.maxTokens && options.maxTokens > this.config.maxTokens) {
      throw new AIError(
        'Max tokens exceeds limit',
        ErrorCode.INVALID_FIELD_VALUE,
        ErrorCategory.VALIDATION,
        false,
        undefined,
        { _message: `Max tokens cannot exceed ${this.config.maxTokens}` }
      );
    }
  }

  private async checkRateLimit(_userId: string): Promise<void> {
    try {
      const isRateLimited = await this.rateLimiter.check(userId);
      if (isRateLimited) {
        throw AIServiceErrors.RATE_LIMIT_EXCEEDED;
      }
    } catch (error) {
      throw AIServiceErrors.RATE_LIMIT_EXCEEDED;
    }
  }

  private async incrementRateLimit(_userId: string): Promise<void> {
    try {
      await this.rateLimiter.increment(userId);
    } catch (error) {
      throw AIServiceErrors.RATE_LIMIT_EXCEEDED;
    }
  }

  private async logRequest(
    _userId: string,
    _prompt: string,
    _options: any,
    _response: any,
    _duration: number
  ): Promise<void> {
    try {
      await this.cache.logRequest({
        userId,
        prompt,
        options,
        response,
        duration,
        _timestamp: Date.now()
      });
    } catch (error) {
      console.error('Failed to log AI _request:', error);
    }
  }

  // Text Generation
  async generateCompletion(
    _userId: string,
    _prompt: string,
    _options: any = {}
  ): Promise<string> {
    try {
      await this.validateRequest(prompt, options);
      await this.checkRateLimit(userId);

      const cacheKey = this.generateCacheKey(prompt, options);
      const cachedResponse = await this.cache.get(cacheKey);

      if (cachedResponse) {
        return cachedResponse;
      }

      const startTime = performance.now();
      const response = await this.withRetry(
        async() => {
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
        },
        'Generating AI completion'
      );

      const duration = performance.now() - startTime;
      const content = response.choices[0]?.message?.content;
      if (content) {
        await this.cache.set(cacheKey, content, this.config.cache.ttl);
        await this.logRequest(userId, prompt, options, content, duration);
      }
      await this.incrementRateLimit(userId);

      return content || '';
    } catch (error) {
      this.handleError(error, 'Generating AI completion');
    }
  }

  async generateChat(
    _userId: string,
    _messages: any[],
    _options: any = {}
  ): Promise<string> {
    try {
      await this.validateRequest(JSON.stringify(messages), options);
      await this.checkRateLimit(userId);

      const cacheKey = this.generateCacheKey(JSON.stringify(messages), options);
      const cachedResponse = await this.cache.get(cacheKey);

      if (cachedResponse) {
        return cachedResponse;
      }

      const startTime = performance.now();
      const response = await this.withRetry(
        async() => {
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
        },
        'Generating AI chat'
      );

      const duration = performance.now() - startTime;
      const content = response.choices[0]?.message?.content;
      if (content) {
        await this.cache.set(cacheKey, content, this.config.cache.ttl);
        await this.logRequest(userId, JSON.stringify(messages), options, content, duration);
      }
      await this.incrementRateLimit(userId);

      return content || '';
    } catch (error) {
      this.handleError(error, 'Generating AI chat');
    }
  }

  // Code Generation
  async generateCode(
    _userId: string,
    _prompt: string,
    _language: string = 'javascript',
    _options: any = {}
  ): Promise<string> {
    try {
      const systemPrompt = `You are a helpful code assistant. Generate code in ${language} language.`;
      return await this.generateChat(
        userId,
        [
          { _role: 'system', _content: systemPrompt },
          { _role: 'user', _content: prompt }
        ],
        options
      );
    } catch (error) {
      this.handleError(error, 'Generating code');
    }
  }

  async generateCodeReview(
    _userId: string,
    _code: string,
    _language: string,
    _options: any = {}
  ): Promise<string> {
    try {
      const systemPrompt = `You are a code reviewer. Review the following ${language} code and provide feedback.`;
      return await this.generateChat(
        userId,
        [
          { _role: 'system', _content: systemPrompt },
          { _role: 'user', _content: code }
        ],
        options
      );
    } catch (error) {
      this.handleError(error, 'Generating code review');
    }
  }

  // Document Processing
  async generateSummary(
    _userId: string,
    _text: string,
    _options: any = {}
  ): Promise<string> {
    try {
      const systemPrompt = 'You are a helpful assistant. Generate a concise summary of the following text.';
      return await this.generateChat(
        userId,
        [
          { _role: 'system', _content: systemPrompt },
          { _role: 'user', _content: text }
        ],
        options
      );
    } catch (error) {
      this.handleError(error, 'Generating summary');
    }
  }

  async generateTranslation(
    _userId: string,
    _text: string,
    _targetLanguage: string,
    _options: any = {}
  ): Promise<string> {
    try {
      const systemPrompt = `You are a translator. Translate the following text into ${targetLanguage}.`;
      return await this.generateChat(
        userId,
        [
          { _role: 'system', _content: systemPrompt },
          { _role: 'user', _content: text }
        ],
        options
      );
    } catch (error) {
      this.handleError(error, 'Generating translation');
    }
  }

  // Model Management
  async listAvailableModels(): Promise<string[]> {
    try {
      const response = await this.openai.models.list();
      return response.data.map((_model: any) => model.id);
    } catch (error) {
      this.handleError(error, 'Listing available models');
    }
  }

  async getModelCapabilities(_model: string): Promise<any> {
    try {
      const response = await this.openai.models.retrieve(model);
      return {
        _maxTokens: (response as any).context_window,
        _temperatureRange: [0, 2],
        _supportedFeatures: (response as any).capabilities
      };
    } catch (error) {
      this.handleError(error, 'Getting model capabilities');
    }
  }

  // Usage Tracking
  async getUsageStats(_userId: string): Promise<any> {
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
    } catch (error) {
      this.handleError(error, 'Getting usage stats');
    }
  }

  // Cache Management
  async clearCache(_userId: string): Promise<void> {
    try {
      await this.cache.clear(userId);
    } catch (error) {
      throw AIServiceErrors.CACHE_ERROR;
    }
  }

  async generateImage(
    _userId: string,
    _prompt: string,
    options?: any
  ): Promise<string | string[]> {
    try {
      await this.validateRequest(prompt, options);
      await this.checkRateLimit(userId);

      const cacheKey = this.generateCacheKey(prompt, options);
      const cachedResponse = await this.cache.get(cacheKey);

      if (cachedResponse) {
        return cachedResponse;
      }

      const startTime = performance.now();
      const response = await this.withRetry(
        async() => {
          return await this.openai.images.generate({
            prompt,
            ...options
          });
        },
        'Generating AI image'
      );

      const duration = performance.now() - startTime;
      const imageUrls = response.data ? response.data.map((_image: any) => image.url) : [];
      await this.cache.set(cacheKey, imageUrls, this.config.cache.ttl);
      await this.logRequest(userId, prompt, options, imageUrls, duration);
      await this.incrementRateLimit(userId);

      return imageUrls;
    } catch (error) {
      this.handleError(error, 'Generating AI image');
    }
  }

  async generateImageEdit(
    _userId: string,
    _image: string,
    _prompt: string,
    mask?: string,
    options?: any
  ): Promise<string | string[]> {
    try {
      await this.validateRequest(prompt, options);
      await this.checkRateLimit(userId);

      const cacheKey = this.generateCacheKey(prompt, options);
      const cachedResponse = await this.cache.get(cacheKey);

      if (cachedResponse) {
        return cachedResponse;
      }

      const startTime = performance.now();
      const response = await this.withRetry(
        async() => {
          return await this.openai.images.edit({
            _image: image,
            _mask: mask,
            prompt,
            ...options
          });
        },
        'Generating AI image edit'
      );

      const duration = performance.now() - startTime;
      const imageUrls = response.data ? response.data.map((_image: any) => image.url) : [];
      await this.cache.set(cacheKey, imageUrls, this.config.cache.ttl);
      await this.logRequest(userId, prompt, options, imageUrls, duration);
      await this.incrementRateLimit(userId);

      return imageUrls;
    } catch (error) {
      this.handleError(error, 'Generating AI image edit');
    }
  }

  async analyzeCode(
    _userId: string,
    _code: string,
    _language: string,
    options?: any
  ): Promise<string> {
    try {
      const systemPrompt = `You are a code analyzer. Analyze the following ${language} code and provide feedback.`;
      return await this.generateChat(
        userId,
        [
          { _role: 'system', _content: systemPrompt },
          { _role: 'user', _content: code }
        ],
        options
      );
    } catch (error) {
      this.handleError(error, 'Analyzing code');
    }
  }

  async generateDocumentation(
    _userId: string,
    _code: string,
    _language: string,
    options?: any
  ): Promise<string> {
    try {
      const systemPrompt = `You are a documentation writer. Generate documentation for the following ${language} code.`;
      return await this.generateChat(
        userId,
        [
          { _role: 'system', _content: systemPrompt },
          { _role: 'user', _content: code }
        ],
        options
      );
    } catch (error) {
      this.handleError(error, 'Generating documentation');
    }
  }

  async analyzeData(
    _userId: string,
    _data: string,
    _question: string,
    options?: any
  ): Promise<string> {
    try {
      const systemPrompt = 'You are a data analyst. Analyze the following data and answer the question.';
      return await this.generateChat(
        userId,
        [
          { _role: 'system', _content: systemPrompt },
          { _role: 'user', _content: `Data: ${data}\nQuestion: ${question}` }
        ],
        options
      );
    } catch (error) {
      this.handleError(error, 'Analyzing data');
    }
  }

  async generateVisualization(
    _userId: string,
    _data: string,
    _question: string,
    options?: any
  ): Promise<string> {
    try {
      const systemPrompt = 'You are a data visualizer. Generate a visualization for the following data and question.';
      return await this.generateChat(
        userId,
        [
          { _role: 'system', _content: systemPrompt },
          { _role: 'user', _content: `Data: ${data}\nQuestion: ${question}` }
        ],
        options
      );
    } catch (error) {
      this.handleError(error, 'Generating visualization');
    }
  }

  async generateBlogPost(
    _userId: string,
    _topic: string,
    options?: any
  ): Promise<string> {
    try {
      const systemPrompt = 'You are a blog post writer. Write a blog post on the following topic.';
      return await this.generateChat(
        userId,
        [
          { _role: 'system', _content: systemPrompt },
          { _role: 'user', _content: topic }
        ],
        options
      );
    } catch (error) {
      this.handleError(error, 'Generating blog post');
    }
  }

  async generateSocialMediaPost(
    _userId: string,
    _topic: string,
    _platform: string,
    options?: any
  ): Promise<string> {
    try {
      const systemPrompt = `You are a social media manager. Write a social media post for ${platform} on the following topic.`;
      return await this.generateChat(
        userId,
        [
          { _role: 'system', _content: systemPrompt },
          { _role: 'user', _content: topic }
        ],
        options
      );
    } catch (error) {
      this.handleError(error, 'Generating social media post');
    }
  }
}
