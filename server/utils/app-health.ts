import { getLogger } from '../../src/logging';
import { metricsCollector } from '../monitoring/metrics-collector';
import { alertManager, AlertSeverity } from '../monitoring/alert-manager';
import { EventEmitter } from 'events';
import { db } from '../../db';
import os from 'os';
import { cpus } from 'os';

const logger = getLogger().child({ component: 'app-health' });

/**
 * Health status of a component
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown'
}

/**
 * Component health check result
 */
export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  message?: string;
  details?: Record<string, any>;
  checkedAt: Date;
}

/**
 * Application health check result
 */
export interface AppHealth {
  status: HealthStatus;
  components: ComponentHealth[];
  checkedAt: Date;
  version: string;
  uptime: number;
}

/**
 * Application health manager
 */
export class AppHealthManager extends EventEmitter {
  private static instance: AppHealthManager;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private components: Map<string, () => Promise<ComponentHealth>> = new Map();
  private lastHealthStatus: HealthStatus = HealthStatus.UNKNOWN;
  private appStartTime: number = Date.now();
  private healthHistory: AppHealth[] = [];
  private version: string = process.env.npm_package_version || '1.0.0';

  /**
   * Get the singleton instance
   */
  public static getInstance(): AppHealthManager {
    if (!AppHealthManager.instance) {
      AppHealthManager.instance = new AppHealthManager();
    }
    return AppHealthManager.instance;
  }

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    super();
    this.registerDefaultComponents();
    
    // Register event listeners for status changes
    this.on('statusChange', (prevStatus: HealthStatus, newStatus: HealthStatus) => {
      this.handleStatusChange(prevStatus, newStatus);
    });
  }

  /**
   * Register default health check components
   */
  private registerDefaultComponents(): void {
    // Database health check
    this.registerComponent('database', this.checkDatabaseHealth.bind(this));
    
    // CPU load health check
    this.registerComponent('cpu', this.checkCpuHealth.bind(this));
    
    // Memory usage health check
    this.registerComponent('memory', this.checkMemoryHealth.bind(this));
    
    // API rate limiting health check
    this.registerComponent('rate-limiting', this.checkRateLimiterHealth.bind(this));
  }

  /**
   * Register a health check component
   */
  public registerComponent(
    name: string,
    checkFn: () => Promise<ComponentHealth>
  ): void {
    this.components.set(name, checkFn);
    logger.info(`Registered health check component: ${name}`);
  }

  /**
   * Unregister a health check component
   */
  public unregisterComponent(name: string): boolean {
    const result = this.components.delete(name);
    if (result) {
      logger.info(`Unregistered health check component: ${name}`);
    }
    return result;
  }

  /**
   * Start periodic health checks
   */
  public startHealthChecks(intervalMs: number = 60000): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    // Run immediately
    this.checkHealth();
    
    // Set interval
    this.healthCheckInterval = setInterval(() => {
      this.checkHealth();
    }, intervalMs);
    
    logger.info(`Started health checks with interval ${intervalMs}ms`);
  }

  /**
   * Stop periodic health checks
   */
  public stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      logger.info('Stopped health checks');
    }
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<ComponentHealth> {
    try {
      const startTime = Date.now();
      
      // Simple query to test database connection
      await db.execute('SELECT 1');
      
      const responseTime = Date.now() - startTime;
      
      // Get connection pool stats if available
      const poolStats = (db as any).connectionManager?.getPoolStats?.() || {
        activeConnections: 0,
        idleConnections: 0,
        waitingClients: 0
      };
      
      // Determine status based on response time and pool status
      let status = HealthStatus.HEALTHY;
      let message = 'Database is healthy';
      
      if (responseTime > 1000) {
        status = HealthStatus.DEGRADED;
        message = `Database response time is slow: ${responseTime}ms`;
      }
      
      if (poolStats.waitingClients > 10) {
        status = HealthStatus.DEGRADED;
        message = `Database connection pool has ${poolStats.waitingClients} waiting clients`;
      }
      
      return {
        name: 'database',
        status,
        message,
        details: {
          responseTime,
          ...poolStats
        },
        checkedAt: new Date()
      };
    } catch (error) {
      logger.error('Database health check failed', { error: (error as Error).message });
      
      return {
        name: 'database',
        status: HealthStatus.UNHEALTHY,
        message: `Database error: ${(error as Error).message}`,
        details: { error: (error as Error).message },
        checkedAt: new Date()
      };
    }
  }

  /**
   * Check CPU health
   */
  private async checkCpuHealth(): Promise<ComponentHealth> {
    try {
      const cpuInfo = cpus();
      const numCpus = cpuInfo.length;
      const loadAvg = os.loadavg();
      const loadAvg1Min = loadAvg[0];
      
      // Normalize load average by number of CPUs
      // A value > 1 means the CPU is overloaded
      const normalizedLoad = loadAvg1Min / numCpus;
      
      let status = HealthStatus.HEALTHY;
      let message = 'CPU load is normal';
      
      if (normalizedLoad > 0.7 && normalizedLoad <= 0.9) {
        status = HealthStatus.DEGRADED;
        message = `CPU load is high: ${(normalizedLoad * 100).toFixed(1)}%`;
      } else if (normalizedLoad > 0.9) {
        status = HealthStatus.UNHEALTHY;
        message = `CPU load is critical: ${(normalizedLoad * 100).toFixed(1)}%`;
      }
      
      return {
        name: 'cpu',
        status,
        message,
        details: {
          loadAvg,
          normalizedLoad,
          numCpus
        },
        checkedAt: new Date()
      };
    } catch (error) {
      return {
        name: 'cpu',
        status: HealthStatus.UNKNOWN,
        message: `Failed to check CPU health: ${(error as Error).message}`,
        checkedAt: new Date()
      };
    }
  }

  /**
   * Check memory health
   */
  private async checkMemoryHealth(): Promise<ComponentHealth> {
    try {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memoryUsagePercent = (usedMem / totalMem) * 100;
      
      let status = HealthStatus.HEALTHY;
      let message = 'Memory usage is normal';
      
      if (memoryUsagePercent > 80 && memoryUsagePercent <= 90) {
        status = HealthStatus.DEGRADED;
        message = `Memory usage is high: ${memoryUsagePercent.toFixed(1)}%`;
      } else if (memoryUsagePercent > 90) {
        status = HealthStatus.UNHEALTHY;
        message = `Memory usage is critical: ${memoryUsagePercent.toFixed(1)}%`;
      }
      
      return {
        name: 'memory',
        status,
        message,
        details: {
          total: totalMem,
          free: freeMem,
          used: usedMem,
          usagePercent: memoryUsagePercent
        },
        checkedAt: new Date()
      };
    } catch (error) {
      return {
        name: 'memory',
        status: HealthStatus.UNKNOWN,
        message: `Failed to check memory health: ${(error as Error).message}`,
        checkedAt: new Date()
      };
    }
  }

  /**
   * Check rate limiter health
   */
  private async checkRateLimiterHealth(): Promise<ComponentHealth> {
    try {
      // This is a placeholder for actual rate limiter metrics
      // In a real implementation, you would get stats from your rate limiter
      
      // For now, we'll just return a healthy status
      return {
        name: 'rate-limiting',
        status: HealthStatus.HEALTHY,
        message: 'Rate limiter is functioning normally',
        details: {
          // Add actual rate limiter stats here
        },
        checkedAt: new Date()
      };
    } catch (error) {
      return {
        name: 'rate-limiting',
        status: HealthStatus.UNKNOWN,
        message: `Failed to check rate limiter health: ${(error as Error).message}`,
        checkedAt: new Date()
      };
    }
  }

  /**
   * Run a full health check
   */
  public async checkHealth(): Promise<AppHealth> {
    logger.debug('Running full health check');
    
    const results: ComponentHealth[] = [];
    
    // Check each component
    for (const [name, checkFn] of this.components.entries()) {
      try {
        const result = await checkFn();
        results.push(result);
      } catch (error) {
        logger.error(`Health check failed for component ${name}`, { error: (error as Error).message });
        
        results.push({
          name,
          status: HealthStatus.UNKNOWN,
          message: `Check failed: ${(error as Error).message}`,
          checkedAt: new Date()
        });
      }
    }
    
    // Determine overall status
    // Unhealthy if any component is unhealthy
    // Degraded if any component is degraded
    // Healthy if all components are healthy
    let overallStatus = HealthStatus.HEALTHY;
    
    for (const result of results) {
      if (result.status === HealthStatus.UNHEALTHY) {
        overallStatus = HealthStatus.UNHEALTHY;
        break;
      } else if (result.status === HealthStatus.DEGRADED) {
        overallStatus = HealthStatus.DEGRADED;
      }
    }
    
    const health: AppHealth = {
      status: overallStatus,
      components: results,
      checkedAt: new Date(),
      version: this.version,
      uptime: Math.floor((Date.now() - this.appStartTime) / 1000)
    };
    
    // Store in history
    this.healthHistory.push(health);
    if (this.healthHistory.length > 100) {
      this.healthHistory.shift();
    }
    
    // Check for status changes
    if (this.lastHealthStatus !== overallStatus) {
      this.emit('statusChange', this.lastHealthStatus, overallStatus);
      this.lastHealthStatus = overallStatus;
    }
    
    // Update metrics
    this.updateMetrics(health);
    
    return health;
  }

  /**
   * Handle status change events
   */
  private handleStatusChange(prevStatus: HealthStatus, newStatus: HealthStatus): void {
    logger.info(`Health status changed from ${prevStatus} to ${newStatus}`);
    
    // Send alerts if status degraded or became unhealthy
    if (newStatus === HealthStatus.DEGRADED) {
      const degradedComponents = this.healthHistory[this.healthHistory.length - 1].components
        .filter(c => c.status === HealthStatus.DEGRADED)
        .map(c => `${c.name}: ${c.message}`);
      
      alertManager.alert({
        title: 'System health degraded',
        message: `The system health status has degraded. Affected components:\n${degradedComponents.join('\n')}`,
        severity: AlertSeverity.WARNING,
        source: 'app-health',
        tags: {
          component: 'health-monitor',
          prevStatus,
          newStatus
        }
      });
    } else if (newStatus === HealthStatus.UNHEALTHY) {
      const unhealthyComponents = this.healthHistory[this.healthHistory.length - 1].components
        .filter(c => c.status === HealthStatus.UNHEALTHY)
        .map(c => `${c.name}: ${c.message}`);
      
      alertManager.alert({
        title: 'System health critical',
        message: `The system health status is critical. Affected components:\n${unhealthyComponents.join('\n')}`,
        severity: AlertSeverity.CRITICAL,
        source: 'app-health',
        tags: {
          component: 'health-monitor',
          prevStatus,
          newStatus
        }
      });
    }
  }

  /**
   * Update metrics from health check
   */
  private updateMetrics(health: AppHealth): void {
    // Update system metrics with health check data
    const dbComponent = health.components.find(c => c.name === 'database');
    if (dbComponent && dbComponent.details) {
      metricsCollector.setCustomMetric('db_response_time_ms', dbComponent.details.responseTime || 0);
      metricsCollector.setCustomMetric('db_active_connections', dbComponent.details.activeConnections || 0);
      metricsCollector.setCustomMetric('db_idle_connections', dbComponent.details.idleConnections || 0);
      metricsCollector.setCustomMetric('db_waiting_clients', dbComponent.details.waitingClients || 0);
    }
    
    // Set health status metrics
    metricsCollector.setCustomMetric('health_status', this.statusToNumeric(health.status));
    metricsCollector.setCustomMetric('uptime_seconds', health.uptime);
    
    // Set component health metrics
    for (const component of health.components) {
      metricsCollector.setCustomMetric(`health_${component.name}`, this.statusToNumeric(component.status));
    }
  }

  /**
   * Convert health status to numeric value for metrics
   */
  private statusToNumeric(status: HealthStatus): number {
    switch (status) {
      case HealthStatus.HEALTHY:
        return 3;
      case HealthStatus.DEGRADED:
        return 2;
      case HealthStatus.UNHEALTHY:
        return 1;
      case HealthStatus.UNKNOWN:
      default:
        return 0;
    }
  }

  /**
   * Get the health history
   */
  public getHealthHistory(): AppHealth[] {
    return [...this.healthHistory];
  }

  /**
   * Shutdown the health manager
   */
  public shutdown(): void {
    this.stopHealthChecks();
  }
}

// Export singleton instance
export const appHealthManager = AppHealthManager.getInstance();
export default appHealthManager;
