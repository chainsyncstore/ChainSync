import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

import { CircuitBreaker, CircuitBreakerOptions, withFallback, FallbackOptions } from './fallback';
import { retry, RetryOptions } from './retry';
import { getLogger } from '../../src/logging/index';

const logger = getLogger().child({ component: 'resilient-http-client' });

/**
 * Configuration options for the resilient HTTP client
 */
export interface ResilientHttpClientOptions {
  /** Base URL for API requests */
  baseURL?: string;

  /** Default timeout in milliseconds (default: 10000) */
  timeout?: number;

  /** Retry configuration for failed requests */
  retry?: RetryOptions;

  /** Circuit breaker configuration */
  circuitBreaker?: CircuitBreakerOptions;

  /** Default headers to include with all requests */
  headers?: Record<string, string>;

  /** Whether to automatically parse JSON responses (default: true) */
  parseJson?: boolean;

  /** Fallback base URLs to try if the primary one fails */
  fallbackBaseURLs?: string[];
}

/**
 * HTTP client with built-in resilience features
 * - Automatic retries with exponential backoff
 * - Circuit breaking for failing endpoints
 * - Fallback URLs
 */
export class ResilientHttpClient {
  private client: AxiosInstance;
  private options: Required<ResilientHttpClientOptions>;
  private circuitBreaker: CircuitBreaker;

  constructor(options: ResilientHttpClientOptions = {}) {
    this.options = {
      baseURL: options.baseURL || '',
      timeout: options.timeout || 10000,
      retry: options.retry || {
        maxAttempts: 3,
        initialDelayMs: 300,
        backoffFactor: 2,
        maxDelayMs: 5000,
        useJitter: true,
        nonRetryableErrors: [
          // Don't retry client errors (4xx) except for specific ones
          (error: unknown) => {
            if (axios.isAxiosError(error) && error.response) {
              const status = error.response.status;
              return (
                status >= 400 &&
                status < 500 &&
                status !== 408 && // Request Timeout
                status !== 429
              ); // Too Many Requests
            }
            return false; // If not an Axios error with a response, or doesn't match, don't treat as non-retryable by this rule
          },
        ],
      },
      circuitBreaker: options.circuitBreaker || {
        failureThreshold: 5,
        resetTimeoutMs: 30000,
        operationName: 'http-client',
      },
      headers: options.headers || {},
      parseJson: options.parseJson !== false,
      fallbackBaseURLs: options.fallbackBaseURLs || [],
    };

    // Create Axios client instance
    this.client = axios.create({
      baseURL: this.options.baseURL,
      timeout: this.options.timeout,
      headers: this.options.headers,
    });

    // Initialize circuit breaker
    this.circuitBreaker = new CircuitBreaker(this.options.circuitBreaker);

    logger.info('Resilient HTTP client initialized', {
      baseURL: this.options.baseURL,
      fallbackCount: this.options.fallbackBaseURLs.length,
      maxRetries: this.options.retry.maxAttempts,
    });
  }

  /**
   * Make a GET request with resilience features
   *
   * @param url Request URL (appended to baseURL)
   * @param config Additional Axios request configuration
   * @returns The response data
   */
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({
      method: 'GET',
      url,
      ...config,
    });
  }

  /**
   * Make a POST request with resilience features
   *
   * @param url Request URL (appended to baseURL)
   * @param data Request body data
   * @param config Additional Axios request configuration
   * @returns The response data
   */
  async post<T = any>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({
      method: 'POST',
      url,
      data,
      ...config,
    });
  }

  /**
   * Make a PUT request with resilience features
   *
   * @param url Request URL (appended to baseURL)
   * @param data Request body data
   * @param config Additional Axios request configuration
   * @returns The response data
   */
  async put<T = any>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({
      method: 'PUT',
      url,
      data,
      ...config,
    });
  }

  /**
   * Make a DELETE request with resilience features
   *
   * @param url Request URL (appended to baseURL)
   * @param config Additional Axios request configuration
   * @returns The response data
   */
  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({
      method: 'DELETE',
      url,
      ...config,
    });
  }

  /**
   * Make a PATCH request with resilience features
   *
   * @param url Request URL (appended to baseURL)
   * @param data Request body data
   * @param config Additional Axios request configuration
   * @returns The response data
   */
  async patch<T = any>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({
      method: 'PATCH',
      url,
      data,
      ...config,
    });
  }

  /**
   * Make a generic HTTP request with resilience features
   *
   * @param config Axios request configuration
   * @returns The response data
   */
  async request<T = any>(config: AxiosRequestConfig): Promise<T> {
    const operationName = `${config.method?.toUpperCase() || 'REQUEST'} ${config.url}`;

    // Handle fallback URLs if provided
    if (this.options.fallbackBaseURLs.length > 0) {
      // Prepare fallback functions
      const fallbacks = this.options.fallbackBaseURLs.map(fallbackBaseURL => {
        return async () => {
          // Create a new configuration with the fallback base URL
          const fallbackConfig = {
            ...config,
            baseURL: fallbackBaseURL,
          };

          // Execute the request with the circuit breaker and retry
          return this.executeRequest<T>(fallbackConfig, operationName);
        };
      });

      // Set up fallback options
      const fallbackOptions: FallbackOptions<T> = {
        fallbacks,
        operationName,
        throwOnFailure: true,
      };

      // Execute the primary request with fallbacks
      const result = await withFallback<T>(
        () => this.executeRequest<T>(config, operationName),
        fallbackOptions
      );

      return result.result as T;
    }

    // No fallbacks, just execute with circuit breaker and retry
    return this.executeRequest<T>(config, operationName);
  }

  /**
   * Execute a request with circuit breaker and retry logic
   */
  private async executeRequest<T>(config: AxiosRequestConfig, operationName: string): Promise<T> {
    // Execute the request with the circuit breaker
    return this.circuitBreaker.execute(async () => {
      // Execute the request with retry logic
      const retryOptions: RetryOptions = {
        ...this.options.retry,
        operationName,
      };

      const result = await retry<AxiosResponse<T>>(
        () => this.client.request<T>(config),
        retryOptions
      );

      if (!result.success) {
        throw result.error;
      }

      // Return the response data
      return result.result.data;
    });
  }

  /**
   * Get the circuit breaker instance
   */
  getCircuitBreaker(): CircuitBreaker {
    return this.circuitBreaker;
  }

  /**
   * Reset the circuit breaker
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
  }

  /**
   * Create a new instance of the client with different options
   */
  clone(options: ResilientHttpClientOptions): ResilientHttpClient {
    return new ResilientHttpClient({
      ...this.options,
      ...options,
    });
  }
}
