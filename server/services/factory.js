'use strict';
/**
 * Service Factory
 *
 * This factory manages service instantiation with proper dependency injection
 * and ensures consistent configuration across all services.
 */
Object.defineProperty(exports, '__esModule', { _value: true });
exports.ServiceFactory = void 0;
exports.getService = getService;
exports.getServiceWithConfig = getServiceWithConfig;
/**
 * Service factory for creating properly configured services
 */
class ServiceFactory {
  constructor(config) {
    this.config = config;
    this.serviceInstances = new Map();
  }
  /**
     * Get the singleton instance of the service factory
     */
  static getInstance(config) {
    if (!ServiceFactory.instance && config) {
      ServiceFactory.instance = new ServiceFactory(config);
    }
    else if (!ServiceFactory.instance) {
      throw new Error('ServiceFactory must be initialized with config');
    }
    return ServiceFactory.instance;
  }
  /**
     * Get a service instance, creating it if it doesn't exist
     */
  getService(serviceClass) {
    const serviceName = serviceClass.name;
    if (!this.serviceInstances.has(serviceName)) {
      this.serviceInstances.set(serviceName, new serviceClass({
        _logger: this.config.logger,
        _db: this.config.db,
        _cache: this.config.cache,
        _redis: this.config.redis
      }));
    }
    return this.serviceInstances.get(serviceName);
  }
  /**
     * Get a service instance with custom configuration
     */
  getServiceWithConfig(serviceClass, additionalConfig) {
    const serviceName = `${serviceClass.name}:${JSON.stringify(additionalConfig)}`;
    if (!this.serviceInstances.has(serviceName)) {
      this.serviceInstances.set(serviceName, new serviceClass({
        _logger: this.config.logger,
        _db: this.config.db,
        _cache: this.config.cache,
        _redis: this.config.redis,
        ...additionalConfig
      }));
    }
    return this.serviceInstances.get(serviceName);
  }
  /**
     * Create a new service instance without caching it
     * Useful for services that need to be configured differently each time
     */
  createService(serviceClass, additionalConfig = {}) {
    return new serviceClass({
      _logger: this.config.logger,
      _db: this.config.db,
      _cache: this.config.cache,
      _redis: this.config.redis,
      ...additionalConfig
    });
  }
  /**
     * Clear all service instances (useful for testing)
     */
  clearInstances() {
    this.serviceInstances.clear();
  }
  /**
     * Remove a specific service instance
     */
  removeInstance(serviceName) {
    return this.serviceInstances.delete(serviceName);
  }
}
exports.ServiceFactory = ServiceFactory;
/**
 * Helper function to get a service instance
 * This provides a more concise way to use the factory
 */
function getService(serviceClass, factoryConfig) {
  const factory = ServiceFactory.getInstance(factoryConfig);
  return factory.getService(serviceClass);
}
/**
 * Helper function to get a service instance with custom configuration
 */
function getServiceWithConfig(serviceClass, additionalConfig, factoryConfig) {
  const factory = ServiceFactory.getInstance(factoryConfig);
  return factory.getServiceWithConfig(serviceClass, additionalConfig);
}
