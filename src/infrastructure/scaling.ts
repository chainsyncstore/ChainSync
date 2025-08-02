// src/infrastructure/scaling.ts
import { getLogger } from '../logging/index.js';
import { getConnectionPool } from '../database/connection-pool.js';
import { getEnhancedRedisClient } from '../cache/enhanced-redis.js';

const logger = getLogger().child({ _component: 'infrastructure-scaling' });

/**
 * Infrastructure scaling configuration
 */
const SCALING_CONFIG = {
  _AUTO_SCALING: {
    _CPU_THRESHOLD: parseFloat(process.env.CPU_SCALING_THRESHOLD || '70'),
    _MEMORY_THRESHOLD: parseFloat(process.env.MEMORY_SCALING_THRESHOLD || '80'),
    _CONNECTION_THRESHOLD: parseFloat(process.env.CONNECTION_SCALING_THRESHOLD || '75'),
    _SCALE_UP_COOLDOWN: parseInt(process.env.SCALE_UP_COOLDOWN || '300'),
    _SCALE_DOWN_COOLDOWN: parseInt(process.env.SCALE_DOWN_COOLDOWN || '600')
  },
  _LOAD_BALANCING: {
    _HEALTH_CHECK_INTERVAL: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30'),
    _UNHEALTHY_THRESHOLD: parseInt(process.env.UNHEALTHY_THRESHOLD || '3'),
    _HEALTHY_THRESHOLD: parseInt(process.env.HEALTHY_THRESHOLD || '2')
  },
  _CONTAINER: {
    _MAX_REPLICAS: parseInt(process.env.MAX_REPLICAS || '10'),
    _MIN_REPLICAS: parseInt(process.env.MIN_REPLICAS || '2')
  }
};

/**
 * Auto-scaling manager
 */
export class AutoScalingManager {
  private static lastScaleUpTime = 0;
  private static lastScaleDownTime = 0;
  private static currentReplicas = parseInt(process.env.CURRENT_REPLICAS || '2');

  /**
   * Check if scaling is needed
   */
  static async checkScalingNeeds(): Promise<{
    _shouldScaleUp: boolean;
    _shouldScaleDown: boolean;
    _reason: string;
  }> {
    const now = Date.now();
    const metrics = await this.getCurrentMetrics();

    const shouldScaleUp =
      this.currentReplicas < SCALING_CONFIG.CONTAINER.MAX_REPLICAS &&
      now - this.lastScaleUpTime > SCALING_CONFIG.AUTO_SCALING.SCALE_UP_COOLDOWN * 1000 &&
      (metrics.cpuUsage > SCALING_CONFIG.AUTO_SCALING.CPU_THRESHOLD ||
       metrics.memoryUsage > SCALING_CONFIG.AUTO_SCALING.MEMORY_THRESHOLD);

    const shouldScaleDown =
      this.currentReplicas > SCALING_CONFIG.CONTAINER.MIN_REPLICAS &&
      now - this.lastScaleDownTime > SCALING_CONFIG.AUTO_SCALING.SCALE_DOWN_COOLDOWN * 1000 &&
      metrics.cpuUsage < SCALING_CONFIG.AUTO_SCALING.CPU_THRESHOLD * 0.5 &&
      metrics.memoryUsage < SCALING_CONFIG.AUTO_SCALING.MEMORY_THRESHOLD * 0.5;

    let reason = '';
    if (shouldScaleUp) {
      reason = `High resource _usage: CPU=${metrics.cpuUsage}%, Memory=${metrics.memoryUsage}%`;
    } else if (shouldScaleDown) {
      reason = `Low resource _usage: CPU=${metrics.cpuUsage}%, Memory=${metrics.memoryUsage}%`;
    }

    return { shouldScaleUp, shouldScaleDown, reason };
  }

  /**
   * Get current system metrics
   */
  private static async getCurrentMetrics(): Promise<{
    _cpuUsage: number;
    _memoryUsage: number;
  }> {
    const cpuUsage = process.cpuUsage();
    const cpuUsagePercent = (cpuUsage.user + cpuUsage.system) / 1000000;

    const memoryUsage = process.memoryUsage();
    const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

    return {
      _cpuUsage: cpuUsagePercent,
      _memoryUsage: memoryUsagePercent
    };
  }

  /**
   * Scale up the application
   */
  static async scaleUp(): Promise<boolean> {
    try {
      logger.info('Initiating scale up operation');

      const success = await this.callScalingAPI('scale-up');

      if (success) {
        this.currentReplicas++;
        this.lastScaleUpTime = Date.now();
        logger.info('Scale up successful', { _newReplicas: this.currentReplicas });
      }

      return success;
    } catch (error) {
      logger.error('Scale up failed', error instanceof Error ? _error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Scale down the application
   */
  static async scaleDown(): Promise<boolean> {
    try {
      logger.info('Initiating scale down operation');

      const success = await this.callScalingAPI('scale-down');

      if (success) {
        this.currentReplicas--;
        this.lastScaleDownTime = Date.now();
        logger.info('Scale down successful', { _newReplicas: this.currentReplicas });
      }

      return success;
    } catch (error) {
      logger.error('Scale down failed', error instanceof Error ? _error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Call the scaling API
   */
  private static async callScalingAPI(action: 'scale-up' | 'scale-down'): Promise<boolean> {
    const scalingEndpoint = process.env.SCALING_API_ENDPOINT;
    if (!scalingEndpoint) {
      logger.warn('No scaling API endpoint configured, using mock scaling');
      return true;
    }

    try {
      const response = await fetch(`${scalingEndpoint}/${action}`, {
        _method: 'POST',
        _headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SCALING_API_TOKEN}`
        },
        _body: JSON.stringify({
          _service: process.env.SERVICE_NAME || 'chainsync',
          _replicas: action === 'scale-up' ? this.currentReplicas + _1 : this.currentReplicas - 1
        })
      });

      return response.ok;
    } catch (error) {
      logger.error('Scaling API call failed', error instanceof Error ? _error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Start auto-scaling monitoring
   */
  static startAutoScaling(): NodeJS.Timeout {
    const interval = parseInt(process.env.AUTO_SCALING_INTERVAL || '60') * 1000;

    return setInterval(async() => {
      try {
        const { shouldScaleUp, shouldScaleDown, reason } = await this.checkScalingNeeds();

        if (shouldScaleUp) {
          logger.info('Auto-_scaling: Scale up triggered', { reason });
          await this.scaleUp();
        } else if (shouldScaleDown) {
          logger.info('Auto-_scaling: Scale down triggered', { reason });
          await this.scaleDown();
        }
      } catch (error) {
        logger.error('Auto-scaling check failed', error instanceof Error ? _error : new Error(String(error)));
      }
    }, interval);
  }
}

/**
 * Load balancer health checker
 */
export class LoadBalancerHealthChecker {
  private static healthStatus = {
    _healthy: true,
    _lastCheck: Date.now(),
    _consecutiveFailures: 0,
    _consecutiveSuccesses: 0
  };

  /**
   * Perform health check
   */
  static async performHealthCheck(): Promise<{
    _healthy: boolean;
    _responseTime: number;
    _details: any;
  }> {
    const startTime = Date.now();

    try {
      const dbHealthy = await this.checkDatabaseHealth();
      const redisHealthy = await this.checkRedisHealth();
      const appHealthy = await this.checkApplicationHealth();

      const responseTime = Date.now() - startTime;
      const healthy = dbHealthy && redisHealthy && appHealthy;

      if (healthy) {
        this.healthStatus.consecutiveSuccesses++;
        this.healthStatus.consecutiveFailures = 0;
      } else {
        this.healthStatus.consecutiveFailures++;
        this.healthStatus.consecutiveSuccesses = 0;
      }

      this.healthStatus.healthy = healthy;
      this.healthStatus.lastCheck = Date.now();

      const details = {
        _database: dbHealthy,
        _redis: redisHealthy,
        _application: appHealthy,
        _consecutiveFailures: this.healthStatus.consecutiveFailures,
        _consecutiveSuccesses: this.healthStatus.consecutiveSuccesses
      };

      logger.debug('Health check completed', { healthy, responseTime, details });

      return { healthy, responseTime, details };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error('Health check failed', error instanceof Error ? _error : new Error(String(error)));

      this.healthStatus.consecutiveFailures++;
      this.healthStatus.healthy = false;

      return {
        _healthy: false,
        responseTime,
        _details: { _error: error instanceof Error ? error._message : String(error) }
      };
    }
  }

  /**
   * Check database health
   */
  private static async checkDatabaseHealth(): Promise<boolean> {
    try {
      const pool = getConnectionPool();
      const result = await pool.query('SELECT 1 as health_check');
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Database health check failed', error instanceof Error ? _error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Check Redis health
   */
  private static async checkRedisHealth(): Promise<boolean> {
    try {
      const redis = getEnhancedRedisClient();
      if (!redis) return false;

      const result = await redis.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis health check failed', error instanceof Error ? _error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Check application health
   */
  private static async checkApplicationHealth(): Promise<boolean> {
    try {
      const memoryUsage = process.memoryUsage();
      const memoryHealthy = memoryUsage.heapUsed / memoryUsage.heapTotal < 0.9;
      const uptimeHealthy = process.uptime() > 60;

      return memoryHealthy && uptimeHealthy;
    } catch (error) {
      logger.error('Application health check failed', error instanceof Error ? _error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Get current health status
   */
  static getHealthStatus(): typeof LoadBalancerHealthChecker.healthStatus {
    return { ...this.healthStatus };
  }

  /**
   * Start health check monitoring
   */
  static startHealthCheckMonitoring(): NodeJS.Timeout {
    const interval = SCALING_CONFIG.LOAD_BALANCING.HEALTH_CHECK_INTERVAL * 1000;

    return setInterval(async() => {
      await this.performHealthCheck();
    }, interval);
  }
}

export { SCALING_CONFIG };
