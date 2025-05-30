import { BaseService } from '../base/service';
import { AIServiceConfig, AIServiceErrors, AIError } from '../../config/ai';
import { CacheService } from '../cache/cache';
import { RateLimiter } from '../rate-limiter/rate-limiter';
import { AppError, ErrorCode, ErrorCategory } from '@shared/types/errors';
import { OpenAI } from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { performance } from 'perf_hooks';
import { AIService } from './types';

export class AIService extends BaseService implements AIService {
  private openai: OpenAI;
  private rateLimiter: RateLimiter;
  private cache: CacheService;
  private config: AIServiceConfig;

  constructor(config: Partial<AIServiceConfig> = {}) {
    super();
    this.config = { ...defaultAIServiceConfig, ...config };
    
    if (!this.config.apiKey) {
      throw AIServiceErrors.INVALID_API_KEY;
    }

    this.openai = new OpenAI({ apiKey: this.config.apiKey });
    this.rateLimiter = new RateLimiter(this.config.rateLimit);
    this.cache = new CacheService(this.config.cache);
  }

  private generateCacheKey(prompt: string, options: unknown): string {
    return `ai:${this.config.model}:${uuidv4()}:${prompt}:${JSON.stringify(options)}`;
  }

  private async validateRequest(prompt: string, options: unknown): Promise<void> {
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
        'Please keep your prompt under 8192 characters'
      );
    }

    if (options.maxTokens && options.maxTokens > this.config.maxTokens) {
      throw new AIError(
        'Max tokens exceeds limit',
        ErrorCode.INVALID_FIELD_VALUE,
        ErrorCategory.VALIDATION,
        false,
        undefined,
        `Max tokens cannot exceed ${this.config.maxTokens}`
      );
    }
  }

  private async checkRateLimit(userId: string): Promise<void> {
    try {
      const isRateLimited = await this.rateLimiter.check(userId);
      if (isRateLimited) {
        throw AIServiceErrors.RATE_LIMIT_EXCEEDED;
      }
    } catch (error: unknown) {
      throw AIServiceErrors.RATE_LIMIT_EXCEEDED;
    }
  }

  private async incrementRateLimit(userId: string): Promise<void> {
    try {
      await this.rateLimiter.increment(userId);
    } catch (error: unknown) {
      throw AIServiceErrors.RATE_LIMIT_EXCEEDED;
    }
  }

  private async logRequest(
    userId: string,
    prompt: string,
    options: unknown,
    response: unknown,
    duration: number
  ): Promise<void> {
    try {
      await this.cache.logRequest({
        userId,
        prompt,
        options,
        response,
        duration,
        timestamp: Date.now()
      });
    } catch (error: unknown) {
      console.error('Failed to log AI request:', error);
    }
  }

  // Text Generation
  async generateCompletion(
    userId: string,
    prompt: string,
    options: unknown = {}
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
        async () => {
          return await this.openai.chat.completions.create({
            model: this.config.model,
            messages: [{ role: 'user', content: prompt }],
            temperature: options.temperature || this.config.temperature,
            max_tokens: options.maxTokens || this.config.maxTokens,
            stop: options.stop,
            top_p: options.topP,
            presence_penalty: options.presencePenalty,
            frequency_penalty: options.frequencyPenalty,
            ...options
          });
        },
        'Generating AI completion'
      );

      const duration = performance.now() - startTime;
      await this.cache.set(cacheKey, response.choices[0].message.content, this.config.cache.ttl);
      await this.logRequest(userId, prompt, options, response.choices[0].message.content, duration);
      await this.incrementRateLimit(userId);

      return response.choices[0].message.content;
    } catch (error: unknown) {
      this.handleError(error, 'Generating AI completion');
    }
  }

  async generateChat(
    userId: string,
    messages: unknown[],
    options: unknown = {}
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
        async () => {
          return await this.openai.chat.completions.create({
            model: this.config.model,
            messages,
            temperature: options.temperature || this.config.temperature,
            max_tokens: options.maxTokens || this.config.maxTokens,
            stop: options.stop,
            top_p: options.topP,
            presence_penalty: options.presencePenalty,
            frequency_penalty: options.frequencyPenalty,
            ...options
          });
        },
        'Generating AI chat'
      );

      const duration = performance.now() - startTime;
      await this.cache.set(cacheKey, response.choices[0].message.content, this.config.cache.ttl);
      await this.logRequest(userId, JSON.stringify(messages), options, response.choices[0].message.content, duration);
      await this.incrementRateLimit(userId);

      return response.choices[0].message.content;
    } catch (error: unknown) {
      this.handleError(error, 'Generating AI chat');
    }
  }

  // Code Generation
  async generateCode(
    userId: string,
    prompt: string,
    language: string = 'javascript',
    options: unknown = {}
  ): Promise<string> {
    try {
      const systemPrompt = `You are a helpful code assistant. Generate code in ${language} language.`;
      return await this.generateChat(
        userId,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        options
      );
    } catch (error: unknown) {
      this.handleError(error, 'Generating code');
    }
  }

  async generateCodeReview(
    userId: string,
    code: string,
    language: string,
    options: unknown = {}
  ): Promise<string> {
    try {
      const systemPrompt = `You are a code reviewer. Review the following ${language} code and provide feedback.`;
      return await this.generateChat(
        userId,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: code }
        ],
        options
      );
    } catch (error: unknown) {
      this.handleError(error, 'Generating code review');
    }
  }

  // Document Processing
  async generateSummary(
    userId: string,
    text: string,
    options: unknown = {}
  ): Promise<string> {
    try {
      const systemPrompt = 'You are a helpful assistant. Generate a concise summary of the following text.';
      return await this.generateChat(
        userId,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        options
      );
    } catch (error: unknown) {
      this.handleError(error, 'Generating summary');
    }
  }

  async generateTranslation(
    userId: string,
    text: string,
    targetLanguage: string,
    options: unknown = {}
  ): Promise<string> {
    try {
      const systemPrompt = `You are a translator. Translate the following text into ${targetLanguage}.`;
      return await this.generateChat(
        userId,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        options
      );
    } catch (error: unknown) {
      this.handleError(error, 'Generating translation');
    }
  }

  // Model Management
  async listAvailableModels(): Promise<string[]> {
    try {
      const response = await this.openai.models.list();
      return response.data.map((model: unknown) => model.id);
    } catch (error: unknown) {
      this.handleError(error, 'Listing available models');
    }
  }

  async getModelCapabilities(model: string): Promise<any> {
    try {
      const response = await this.openai.models.retrieve(model);
      return {
        maxTokens: response.max_tokens,
        temperatureRange: [0, 2],
        supportedFeatures: response.capabilities
      };
    } catch (error: unknown) {
      this.handleError(error, 'Getting model capabilities');
    }
  }

  // Usage Tracking
  async getUsageStats(userId: string): Promise<any> {
    try {
      const stats = await this.cache.getUsageStats(userId);
      return {
        totalRequests: stats?.totalRequests || 0,
        averageDuration: stats?.averageDuration || 0,
        lastRequest: stats?.lastRequest,
        rateLimit: {
          maxRequests: this.config.rateLimit.maxRequests,
          window: this.config.rateLimit.window,
          remaining: await this.rateLimiter.getRemaining(userId)
        }
      };
    } catch (error: unknown) {
      this.handleError(error, 'Getting usage stats');
    }
  }

  // Cache Management
  async clearCache(userId: string): Promise<void> {
    try {
      await this.cache.clear(userId);
    } catch (error: unknown) {
      throw AIServiceErrors.CACHE_ERROR;
    }
  }
}
