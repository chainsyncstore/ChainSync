// src/resilience/circuit-breaker.ts
import { getLogger } from '../logging/index.js';
import { EventEmitter } from 'events';

const logger = getLogger().child({ component: 'circuit-breaker' });

/**
 * Circuit breaker states
 */
export enum CircuitState {
  CLOSED = 'CLOSED',      // Normal operation
  OPEN = 'OPEN',          // Failing, reject requests
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;     // Number of failures before opening
  recoveryTimeout: number;      // Time to wait before trying half-open (ms)
  expectedException: (error: Error) => boolean; // Which errors count as failures
  monitorInterval: number;      // How often to check circuit state (ms)
  volumeThreshold: number;      // Minimum requests before circuit can open
}

/**
 * Circuit breaker statistics
 */
export interface CircuitStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  totalRequests: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  nextAttemptTime?: number;
}

/**
 * Circuit breaker implementation
 */
export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private nextAttemptTime?: number;
  private monitorTimer?: NodeJS.Timeout;

  constructor(
    private readonly name: string,
    private readonly config: CircuitBreakerConfig
  ) {
    super();
    this.startMonitoring();
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < (this.nextAttemptTime || 0)) {
        throw new CircuitBreakerOpenError(this.name);
      }
      this.transitionToHalfOpen();
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    }
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    this.successCount++;
    this.lastSuccessTime = Date.now();
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionToClosed();
    }
    
    this.emit('success', { name: this.name, timestamp: Date.now() });
  }

  /**
   * Handle failed operation
   */
  private onFailure(error: Error): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.config.expectedException(error) && 
        this.failureCount >= this.config.failureThreshold &&
        this.getTotalRequests() >= this.config.volumeThreshold) {
      this.transitionToOpen();
    }
    
    this.emit('failure', { 
      name: this.name, 
      error: error.message, 
      timestamp: Date.now() 
    });
  }

  /**
   * Transition to closed state
   */
  private transitionToClosed(): void {
    logger.info('Circuit breaker transitioning to CLOSED', { name: this.name });
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttemptTime = 0;
    this.emit('stateChange', { 
      name: this.name, 
      state: CircuitState.CLOSED, 
      timestamp: Date.now() 
    });
  }

  /**
   * Transition to open state
   */
  private transitionToOpen(): void {
    logger.warn('Circuit breaker transitioning to OPEN', { 
      name: this.name, 
      failureCount: this.failureCount 
    });
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = Date.now() + this.config.recoveryTimeout;
    this.emit('stateChange', { 
      name: this.name, 
      state: CircuitState.OPEN, 
      timestamp: Date.now() 
    });
  }

  /**
   * Transition to half-open state
   */
  private transitionToHalfOpen(): void {
    logger.info('Circuit breaker transitioning to HALF_OPEN', { name: this.name });
    this.state = CircuitState.HALF_OPEN;
    this.emit('stateChange', { 
      name: this.name, 
      state: CircuitState.HALF_OPEN, 
      timestamp: Date.now() 
    });
  }

  /**
   * Get total number of requests
   */
  private getTotalRequests(): number {
    return this.successCount + this.failureCount;
  }

  /**
   * Start monitoring circuit state
   */
  private startMonitoring(): void {
    this.monitorTimer = setInterval(() => {
      this.emit('stats', this.getStats());
    }, this.config.monitorInterval);
  }

  /**
   * Get current circuit statistics
   */
  getStats(): CircuitStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalRequests: this.getTotalRequests(),
      ...(this.lastFailureTime !== undefined && { lastFailureTime: this.lastFailureTime }),
      ...(this.lastSuccessTime !== undefined && { lastSuccessTime: this.lastSuccessTime }),
      ...(this.nextAttemptTime !== undefined && { nextAttemptTime: this.nextAttemptTime }),
    };
  }

  /**
   * Manually reset circuit to closed state
   */
  reset(): void {
    this.transitionToClosed();
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
    }
    this.removeAllListeners();
  }
}

/**
 * Circuit breaker error
 */
export class CircuitBreakerOpenError extends Error {
  constructor(circuitName: string) {
    super(`Circuit breaker '${circuitName}' is open`);
    this.name = 'CircuitBreakerOpenError';
  }
}

/**
 * Circuit breaker factory
 */
export class CircuitBreakerFactory {
  private static breakers = new Map<string, CircuitBreaker>();

  /**
   * Create or get a circuit breaker instance
   */
  static create(
    name: string,
    config: Partial<CircuitBreakerConfig> = {}
  ): CircuitBreaker {
    if (this.breakers.has(name)) {
      return this.breakers.get(name)!;
    }

    const defaultConfig: CircuitBreakerConfig = {
      failureThreshold: 5,
      recoveryTimeout: 60000, // 1 minute
      expectedException: (error: Error) => {
        // Consider network errors, timeouts, and 5xx errors as failures
        return error.name === 'TimeoutError' ||
               error.message.includes('ECONNREFUSED') ||
               error.message.includes('ENOTFOUND') ||
               error.message.includes('ETIMEDOUT');
      },
      monitorInterval: 10000, // 10 seconds
      volumeThreshold: 10,
    };

    const finalConfig = { ...defaultConfig, ...config };
    const breaker = new CircuitBreaker(name, finalConfig);
    
    this.breakers.set(name, breaker);
    return breaker;
  }

  /**
   * Get all circuit breakers
   */
  static getAll(): Map<string, CircuitBreaker> {
    return new Map(this.breakers);
  }

  /**
   * Get circuit breaker statistics
   */
  static getStats(): Record<string, CircuitStats> {
    const stats: Record<string, CircuitStats> = {};
    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }

  /**
   * Reset all circuit breakers
   */
  static resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }

  /**
   * Clean up all circuit breakers
   */
  static destroyAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.destroy();
    }
    this.breakers.clear();
  }
} 