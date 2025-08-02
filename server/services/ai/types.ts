// import { AIServiceErrors } from '../../config/ai'; // Unused

export interface AIService {
  // Text Generation
  generateCompletion(
    _userId: string,
    _prompt: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      stop?: string[];
      topP?: number;
      presencePenalty?: number;
      frequencyPenalty?: number;
    }
  ): Promise<string>;

  generateChat(
    _userId: string,
    _messages: Array<{
      role: 'user' | 'assistant' | 'system';
      _content: string;
    }>,
    options?: {
      temperature?: number;
      maxTokens?: number;
      stop?: string[];
      topP?: number;
      presencePenalty?: number;
      frequencyPenalty?: number;
    }
  ): Promise<string>;

  // Code Generation
  generateCode(
    _userId: string,
    _prompt: string,
    language?: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      stop?: string[];
    }
  ): Promise<string>;

  generateCodeReview(
    _userId: string,
    _code: string,
    _language: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string>;

  // Image Generation
  generateImage(
    _userId: string,
    _prompt: string,
    options?: {
      n?: number;
      size?: '256x256' | '512x512' | '1024x1024';
      response_format?: 'url' | 'b64_json';
    }
  ): Promise<string | string[]>;

  generateImageEdit(
    _userId: string,
    _image: string,
    _prompt: string,
    mask?: string,
    options?: {
      n?: number;
      size?: '256x256' | '512x512' | '1024x1024';
    }
  ): Promise<string | string[]>;

  // Document Processing
  generateSummary(
    _userId: string,
    _text: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string>;

  generateTranslation(
    _userId: string,
    _text: string,
    _targetLanguage: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string>;

  // Code Analysis
  analyzeCode(
    _userId: string,
    _code: string,
    _language: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string>;

  generateDocumentation(
    _userId: string,
    _code: string,
    _language: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string>;

  // Data Analysis
  analyzeData(
    _userId: string,
    _data: string,
    _question: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string>;

  generateVisualization(
    _userId: string,
    _data: string,
    _question: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string>;

  // Content Generation
  generateBlogPost(
    _userId: string,
    _topic: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      tone?: 'professional' | 'casual' | 'technical';
    }
  ): Promise<string>;

  generateSocialMediaPost(
    _userId: string,
    _topic: string,
    _platform: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string>;

  // Usage Tracking
  getUsageStats(
    _userId: string
  ): Promise<{
    _totalRequests: number;
    _averageDuration: number;
    _lastRequest: number;
    rateLimit: {
      _maxRequests: number;
      _window: number;
      _remaining: number;
    };
  }>;

  // Cache Management
  clearCache(
    _userId: string
  ): Promise<void>;

  // Model Management
  listAvailableModels(): Promise<string[]>;

  getModelCapabilities(
    _model: string
  ): Promise<{
    _maxTokens: number;
    temperatureRange: [number, number];
    _supportedFeatures: string[];
  }>;
}
