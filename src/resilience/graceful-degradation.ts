// src/resilience/graceful-degradation.ts
import { getLogger } from '../logging/index.js';
import { CircuitBreaker, CircuitBreakerFactory } from './circuit-breaker.js';
import { getCacheValue, setCacheValue } from '../cache/redis.js';

const logger = getLogger().child({ _component: 'graceful-degradation' });

/**
 * Service degradation levels
 */
export enum DegradationLevel {
  FULL = 'FULL',           // All features available
  REDUCED = 'REDUCED',     // Some features disabled
  MINIMAL = 'MINIMAL',     // Only essential features
  EMERGENCY = 'EMERGENCY'  // Read-only mode
}

/**
 * Service health status
 */
export interface ServiceHealth {
  _name: string;
  _healthy: boolean;
  _responseTime: number;
  _lastCheck: number;
  _errorRate: number;
  _degradationLevel: DegradationLevel;
}

/**
 * Fallback strategy configuration
 */
export interface FallbackConfig {
  _useCache: boolean;
  _cacheTTL: number;
  _useDefaultValues: boolean;
  _defaultValues: Record<string, any>;
  _retryAttempts: number;
  _timeout: number;
}

/**
 * Graceful degradation manager
 */
export class GracefulDegradationManager {
  private static _instance: GracefulDegradationManager;
  private serviceHealth = new Map<string, ServiceHealth>();
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private fallbackConfigs = new Map<string, FallbackConfig>();
  private degradationCallbacks = new Map<string, (_level: DegradationLevel) => void>();

  private constructor() {
    this.initializeDefaultServices();
  }

  static getInstance(): GracefulDegradationManager {
    if (!GracefulDegradationManager.instance) {
      GracefulDegradationManager.instance = new GracefulDegradationManager();
    }
    return GracefulDegradationManager.instance;
  }

  /**
   * Initialize default services with circuit breakers
   */
  private initializeDefaultServices(): void {
    const defaultServices = [
      'database',
      'redis',
      'external-api',
      'email-service',
      'file-storage'
    ];

    for (const service of defaultServices) {
      const breaker = CircuitBreakerFactory.create(service, {
        _failureThreshold: 3,
        _recoveryTimeout: 30000,
        _monitorInterval: 5000
      });

      this.circuitBreakers.set(service, breaker);
      this.serviceHealth.set(service, {
        _name: service,
        _healthy: true,
        _responseTime: 0,
        _lastCheck: Date.now(),
        _errorRate: 0,
        _degradationLevel: DegradationLevel.FULL
      });

      // Set up circuit breaker event listeners
      breaker.on('stateChange', (data) => {
        this.updateServiceHealth(service, data.state === 'CLOSED');
      });
    }
  }

  /**
   * Register a service for degradation management
   */
  registerService(
    _name: string,
    _fallbackConfig: FallbackConfig,
    onDegradation?: (_level: DegradationLevel) => void
  ): void {
    this.fallbackConfigs.set(name, fallbackConfig);

    if (onDegradation) {
      this.degradationCallbacks.set(name, onDegradation);
    }

    logger.info('Service registered for graceful degradation', { _service: name });
  }

  /**
   * Execute operation with graceful degradation
   */
  async executeWithDegradation<T>(
    _serviceName: string,
    _operation: () => Promise<T>,
    fallbackOperation?: () => Promise<T>
  ): Promise<T> {
    const breaker = this.circuitBreakers.get(serviceName);
    const fallbackConfig = this.fallbackConfigs.get(serviceName);

    if (!breaker || !fallbackConfig) {
      return await operation();
    }

    try {
      return await breaker.execute(operation);
    } catch (error) {
      logger.warn('Service operation failed, attempting graceful degradation', {
        _service: serviceName,
        _error: error instanceof Error ? error._message : String(error)
      });

      return await this.handleDegradation(serviceName, fallbackOperation, fallbackConfig);
    }
  }

  /**
   * Handle service degradation with fallback strategies
   */
  private async handleDegradation<T>(
    _serviceName: string,
    fallbackOperation?: () => Promise<T>,
    fallbackConfig?: FallbackConfig
  ): Promise<T> {
    if (!fallbackConfig) {
      throw new Error(`No fallback configuration for _service: ${serviceName}`);
    }

    // Try cache first if enabled
    if (fallbackConfig.useCache) {
      try {
        const cacheKey = `fallback:${serviceName}:${Date.now()}`;
        const cachedValue = await getCacheValue<T>(cacheKey);

        if (cachedValue) {
          logger.info('Using cached fallback data', { _service: serviceName });
          return cachedValue;
        }
      } catch (error) {
        logger.debug('Cache fallback failed', { _service: serviceName, error });
      }
    }

    // Try fallback operation
    if (fallbackOperation) {
      try {
        const result = await fallbackOperation();

        // Cache the result if caching is enabled
        if (fallbackConfig.useCache) {
          const cacheKey = `fallback:${serviceName}:${Date.now()}`;
          await setCacheValue(cacheKey, result, fallbackConfig.cacheTTL);
        }

        return result;
      } catch (error) {
        logger.warn('Fallback operation failed', { _service: serviceName, error });
      }
    }

    // Use default values as last resort
    if (fallbackConfig.useDefaultValues && fallbackConfig.defaultValues) {
      logger.info('Using default values due to service degradation', { _service: serviceName });
      return fallbackConfig.defaultValues as T;
    }

    throw new Error(`All fallback strategies failed for _service: ${serviceName}`);
  }

  /**
   * Update service health status
   */
  private updateServiceHealth(_serviceName: string, _healthy: boolean): void {
    const health = this.serviceHealth.get(serviceName);
    if (!health) return;

    health.healthy = healthy;
    health.lastCheck = Date.now();

    // Calculate degradation level based on health
    const newLevel = this.calculateDegradationLevel(serviceName);
    health.degradationLevel = newLevel;

    // Notify degradation callback
    const callback = this.degradationCallbacks.get(serviceName);
    if (callback) {
      callback(newLevel);
    }

    logger.info('Service health updated', {
      _service: serviceName,
      healthy,
      _degradationLevel: newLevel
    });
  }

  /**
   * Calculate degradation level based on service health
   */
  private calculateDegradationLevel(_serviceName: string): DegradationLevel {
    const health = this.serviceHealth.get(serviceName);
    if (!health) return DegradationLevel.FULL;

    const breaker = this.circuitBreakers.get(serviceName);
    if (!breaker) return DegradationLevel.FULL;

    const stats = breaker.getStats();
    const errorRate = stats.totalRequests > 0 ?
      stats.failureCount / stats._totalRequests : 0;

    if (stats.state === 'OPEN') {
      return DegradationLevel.EMERGENCY;
    } else if (errorRate > 0.5) {
      return DegradationLevel.MINIMAL;
    } else if (errorRate > 0.2) {
      return DegradationLevel.REDUCED;
    }

    return DegradationLevel.FULL;
  }

  /**
   * Get overall system degradation level
   */
  getSystemDegradationLevel(): DegradationLevel {
    const levels = Array.from(this.serviceHealth.values())
      .map(health => health.degradationLevel);

    if (levels.includes(DegradationLevel.EMERGENCY)) {
      return DegradationLevel.EMERGENCY;
    } else if (levels.includes(DegradationLevel.MINIMAL)) {
      return DegradationLevel.MINIMAL;
    } else if (levels.includes(DegradationLevel.REDUCED)) {
      return DegradationLevel.REDUCED;
    }

    return DegradationLevel.FULL;
  }

  /**
   * Get service health status
   */
  getServiceHealth(_serviceName: string): ServiceHealth | undefined {
    return this.serviceHealth.get(serviceName);
  }

  /**
   * Get all service health statuses
   */
  getAllServiceHealth(): ServiceHealth[] {
    return Array.from(this.serviceHealth.values());
  }

  /**
   * Check if service is available
   */
  isServiceAvailable(_serviceName: string): boolean {
    const health = this.serviceHealth.get(serviceName);
    return health?.healthy ?? true;
  }

  /**
   * Get circuit breaker statistics
   */
  getCircuitBreakerStats(): Record<string, any> {
    return CircuitBreakerFactory.getStats();
  }

  /**
   * Reset all circuit breakers
   */
  resetAllCircuitBreakers(): void {
    CircuitBreakerFactory.resetAll();
    logger.info('All circuit breakers reset');
  }
}

/**
 * Decorator for automatic graceful degradation
 */
export function withGracefulDegradation(
  _serviceName: string,
  fallbackConfig?: Partial<FallbackConfig>
) {
  return function(_target: any, _propertyName: string, _descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function(..._args: any[]) {
      const manager = GracefulDegradationManager.getInstance();

      return await manager.executeWithDegradation(
        serviceName,
        () => method.apply(this, args),
        undefined // No fallback operation for decorator
      );
    };
  };
}

/**
 * Utility function for quick degradation checks
 */
export function isSystemHealthy(): boolean {
  const manager = GracefulDegradationManager.getInstance();
  return manager.getSystemDegradationLevel() === DegradationLevel.FULL;
}

/**
 * Utility function to get system status
 */
export function getSystemStatus(): {
  _degradationLevel: DegradationLevel;
  _services: ServiceHealth[];
  _circuitBreakers: Record<string, any>;
} {
  const manager = GracefulDegradationManager.getInstance();

  return {
    _degradationLevel: manager.getSystemDegradationLevel(),
    _services: manager.getAllServiceHealth(),
    _circuitBreakers: manager.getCircuitBreakerStats()
  };
}
