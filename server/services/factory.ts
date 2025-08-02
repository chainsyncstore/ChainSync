/**
 * Service Factory
 *
 * This factory manages service instantiation with proper dependency injection
 * and ensures consistent configuration across all services.
 */

import { db } from '../db'; // or adjust the path as needed
import { getLogger } from '../../src/logging';
import Redis from 'ioredis';

import { BaseService } from './base/base-service';
import { CacheService } from './cache';

export type ServiceConfig = {
  logger: ReturnType<typeof getLogger>;
  db: typeof db;
  cache: CacheService;
  redis: Redis;
};

/**
 * Service factory for creating properly configured services
 */
export class ServiceFactory {
  private static instance: ServiceFactory;
  private readonly serviceInstances: Map<string, any> = new Map();

  private constructor(
    private readonly config: {
      logger: ReturnType<typeof getLogger>;
      db: typeof db;
      cache?: CacheService;
      redis?: Redis;
    }
  ) {}

  /**
   * Get the singleton instance of the service factory
   */
  public static getInstance(config?: {
    logger: ReturnType<typeof getLogger>;
    db: typeof db;
    cache?: CacheService;
    redis?: Redis;
  }): ServiceFactory {
    if (!ServiceFactory.instance && config) {
      ServiceFactory.instance = new ServiceFactory(config);
    } else if (!ServiceFactory.instance) {
      throw new Error('ServiceFactory must be initialized with config');
    }

    return ServiceFactory.instance;
  }

  /**
   * Get a service instance, creating it if it doesn't exist
   */
  public getService<T>(serviceClass: new (config: ServiceConfig) => T): T {
    const serviceName = serviceClass.name;

    if (!this.serviceInstances.has(serviceName)) {
      this.serviceInstances.set(
        serviceName,
        new serviceClass({
          logger: this.config.logger,
          db: this.config.db,
          cache: this.config.cache!,
          redis: this.config.redis!
        })
      );
    }

    return this.serviceInstances.get(serviceName) as T;
  }

  /**
   * Get a service instance with custom configuration
   */
  public getServiceWithConfig<T>(
    serviceClass: new (config: ServiceConfig & Record<string, any>) => T,
    additionalConfig: Record<string, any>
  ): T {
    const serviceName = `${serviceClass.name}:${JSON.stringify(additionalConfig)}`;

    if (!this.serviceInstances.has(serviceName)) {
      this.serviceInstances.set(
        serviceName,
        new serviceClass({
          logger: this.config.logger,
          db: this.config.db,
          cache: this.config.cache!,
          redis: this.config.redis!,
          ...additionalConfig
        })
      );
    }

    return this.serviceInstances.get(serviceName) as T;
  }

  /**
   * Create a new service instance without caching it
   * Useful for services that need to be configured differently each time
   */
  public createService<T>(
    serviceClass: new (config: ServiceConfig & Record<string, any>) => T,
    additionalConfig: Record<string, any> = {}
  ): T {
    return new serviceClass({
      logger: this.config.logger,
      db: this.config.db,
      cache: this.config.cache!,
      redis: this.config.redis!,
      ...additionalConfig
    });
  }

  /**
   * Clear all service instances (useful for testing)
   */
  public clearInstances(): void {
    this.serviceInstances.clear();
  }

  /**
   * Remove a specific service instance
   */
  public removeInstance(serviceName: string): boolean {
    return this.serviceInstances.delete(serviceName);
  }
}

/**
 * Helper function to get a service instance
 * This provides a more concise way to use the factory
 */
export function getService<T>(
  serviceClass: new (config: ServiceConfig) => T,
  factoryConfig?: {
    logger: ReturnType<typeof getLogger>;
    db: typeof db;
    cache?: CacheService;
    redis?: Redis;
  }
): T {
  const factory = ServiceFactory.getInstance(factoryConfig);
  return factory.getService(serviceClass);
}

/**
 * Helper function to get a service instance with custom configuration
 */
export function getServiceWithConfig<T>(
  serviceClass: new (config: ServiceConfig & Record<string, any>) => T,
  additionalConfig: Record<string, any>,
  factoryConfig?: {
    logger: ReturnType<typeof getLogger>;
    db: typeof db;
    cache?: CacheService;
    redis?: Redis;
  }
): T {
  const factory = ServiceFactory.getInstance(factoryConfig);
  return factory.getServiceWithConfig(serviceClass, additionalConfig);
}
