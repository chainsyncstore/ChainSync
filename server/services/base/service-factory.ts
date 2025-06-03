/**
 * Service Factory
 * 
 * This file defines the standardized service factory for creating service instances
 * with proper dependency injection.
 */

import { Logger, getLogger as getSrcLogger } from '../../../src/logging'; // Use logger from src
import { DrizzleClient } from '../../db/types';
import { RedisClientType } from 'redis';
import { CacheService } from '../cache/cache-service';

/**
 * Standard service configuration interface for dependency injection
 */
export interface ServiceConfig {
  db: DrizzleClient;
  redis: RedisClientType;
  logger: Logger;
  cache?: CacheService;
}

/**
 * Service Factory for creating service instances with appropriate dependencies
 */
export class ServiceFactory {
  private readonly config: ServiceConfig;
  
  /**
   * Constructor initializes the factory with core dependencies
   */
  constructor(
    db: DrizzleClient,
    redis: RedisClientType,
    logger: Logger
  ) {
    this.config = {
      db,
      redis,
      logger: logger.child({ component: 'ServiceFactory' }),
    };
    
    // Initialize cache service if redis is available
    this.config.cache = new CacheService({ 
      redis: redis,
      logger: this.config.logger.child({ service: 'CacheService' })
    });
    
    this.config.logger.info('ServiceFactory initialized');
  }
  
  /**
   * Create a new service instance with injected dependencies
   */
  create<T>(ServiceClass: new (config: ServiceConfig) => T): T {
    this.config.logger.debug(`Creating service instance: ${ServiceClass.name}`);
    return new ServiceClass(this.config);
  }
  
  /**
   * Get the base config for extending with additional dependencies
   */
  getBaseConfig(): ServiceConfig {
    return { ...this.config };
  }
  
  /**
   * Create a service config with additional dependencies
   */
  createConfig(additionalDependencies: Record<string, any> = {}): ServiceConfig {
    return {
      ...this.config,
      ...additionalDependencies
    };
  }
}
