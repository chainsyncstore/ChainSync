import { AIServiceErrors } from '../../config/ai';

export interface AIService {
  // Text Generation
  generateCompletion(
    userId: string,
    prompt: string,
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
    userId: string,
    messages: Array<{
      role: 'user' | 'assistant' | 'system';
      content: string;
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
    userId: string,
    prompt: string,
    language?: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      stop?: string[];
    }
  ): Promise<string>;

  generateCodeReview(
    userId: string,
    code: string,
    language: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string>;

  // Image Generation
  generateImage(
    userId: string,
    prompt: string,
    options?: {
      n?: number;
      size?: '256x256' | '512x512' | '1024x1024';
      response_format?: 'url' | 'b64_json';
    }
  ): Promise<string | string[]>;

  generateImageEdit(
    userId: string,
    image: string,
    mask?: string,
    prompt: string,
    options?: {
      n?: number;
      size?: '256x256' | '512x512' | '1024x1024';
    }
  ): Promise<string | string[]>;

  // Document Processing
  generateSummary(
    userId: string,
    text: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string>;

  generateTranslation(
    userId: string,
    text: string,
    targetLanguage: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string>;

  // Code Analysis
  analyzeCode(
    userId: string,
    code: string,
    language: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string>;

  generateDocumentation(
    userId: string,
    code: string,
    language: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string>;

  // Data Analysis
  analyzeData(
    userId: string,
    data: string,
    question: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string>;

  generateVisualization(
    userId: string,
    data: string,
    question: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string>;

  // Content Generation
  generateBlogPost(
    userId: string,
    topic: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      tone?: 'professional' | 'casual' | 'technical';
    }
  ): Promise<string>;

  generateSocialMediaPost(
    userId: string,
    topic: string,
    platform: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string>;

  // Error Handling
  handleError(
    error: Error,
    context: string
  ): never;

  // Usage Tracking
  getUsageStats(
    userId: string
  ): Promise<{
    totalRequests: number;
    averageDuration: number;
    lastRequest: number;
    rateLimit: {
      maxRequests: number;
      window: number;
      remaining: number;
    };
  }>;

  // Cache Management
  clearCache(
    userId: string
  ): Promise<void>;

  // Model Management
  listAvailableModels(): Promise<string[]>;

  getModelCapabilities(
    model: string
  ): Promise<{
    maxTokens: number;
    temperatureRange: [number, number];
    supportedFeatures: string[];
  }>;
}
