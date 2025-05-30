import os from 'os';
import { getLogger } from '../../src/logging';
import { EventEmitter } from 'events';
import { alertManager, AlertSeverity } from './alert-manager';
import { db } from '../../db';

const logger = getLogger().child({ component: 'metrics-collector' });

/**
 * System metrics interface
 */
export interface SystemMetrics {
  timestamp: number;
  cpu: {
    usage: number;  // CPU usage percentage
    loadAvg: number[];  // Load average [1, 5, 15 minutes]
    count: number;  // Number of CPU cores
  };
  memory: {
    total: number;  // Total memory in bytes
    free: number;  // Free memory in bytes
    used: number;  // Used memory in bytes
    usagePercent: number;  // Memory usage percentage
  };
  disk: {
    total: number;  // Total disk space in bytes
    free: number;  // Free disk space in bytes
    used: number;  // Used disk space in bytes
    usagePercent: number;  // Disk usage percentage
  };
  process: {
    uptime: number;  // Process uptime in seconds
    memory: number;  // Process memory usage in bytes
    cpu: number;  // Process CPU usage percentage
    activeHandles: number;  // Active handles
    activeRequests: number;  // Active requests
  };
  network: {
    connections: number;  // Number of active connections
    bytesReceived: number;  // Bytes received since last collection
    bytesSent: number;  // Bytes sent since last collection
    requestsPerSecond: number;  // Requests per second
  };
  database: {
    connections: number;  // Number of active database connections
    queryTime: number;  // Average query time in milliseconds
    queryCount: number;  // Queries since last collection
  };
  custom: Record<string, number>;  // Custom metrics
}

/**
 * Thresholds for alerting
 */
export interface MetricsThresholds {
  cpu: {
    warning: number;  // CPU usage percentage for warning
    critical: number;  // CPU usage percentage for critical
  };
  memory: {
    warning: number;  // Memory usage percentage for warning
    critical: number;  // Memory usage percentage for critical
  };
  disk: {
    warning: number;  // Disk usage percentage for warning
    critical: number;  // Disk usage percentage for critical
  };
  queryTime: {
    warning: number;  // Query time in ms for warning
    critical: number;  // Query time in ms for critical
  };
}

/**
 * Default thresholds
 */
const DEFAULT_THRESHOLDS: MetricsThresholds = {
  cpu: {
    warning: 80,
    critical: 90
  },
  memory: {
    warning: 80,
    critical: 90
  },
  disk: {
    warning: 80,
    critical: 90
  },
  queryTime: {
    warning: 1000,
    critical: 3000
  }
};

/**
 * System metrics collector
 */
export class MetricsCollector extends EventEmitter {
  private static instance: MetricsCollector;
  private collectionInterval: NodeJS.Timeout | null = null;
  private metrics: SystemMetrics | null = null;
  private prevMetrics: SystemMetrics | null = null;
  private customMetrics: Record<string, number> = {};
  private thresholds: MetricsThresholds;
  private isCollecting: boolean = false;
  private netStatsLastUpdate: number = Date.now();
  private bytesReceivedLast: number = 0;
  private bytesSentLast: number = 0;
  private requestCountLast: number = 0;

  /**
   * Get the singleton instance
   */
  public static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    super();
    this.thresholds = DEFAULT_THRESHOLDS;
    
    // Load thresholds from environment variables
    this.loadThresholdsFromEnv();
    
    // Listen for metrics collection
    this.on('metrics', this.checkThresholds.bind(this));
  }

  /**
   * Load thresholds from environment variables
   */
  private loadThresholdsFromEnv(): void {
    // CPU thresholds
    if (process.env.METRICS_CPU_WARNING) {
      this.thresholds.cpu.warning = parseInt(process.env.METRICS_CPU_WARNING, 10);
    }
    if (process.env.METRICS_CPU_CRITICAL) {
      this.thresholds.cpu.critical = parseInt(process.env.METRICS_CPU_CRITICAL, 10);
    }
    
    // Memory thresholds
    if (process.env.METRICS_MEMORY_WARNING) {
      this.thresholds.memory.warning = parseInt(process.env.METRICS_MEMORY_WARNING, 10);
    }
    if (process.env.METRICS_MEMORY_CRITICAL) {
      this.thresholds.memory.critical = parseInt(process.env.METRICS_MEMORY_CRITICAL, 10);
    }
    
    // Disk thresholds
    if (process.env.METRICS_DISK_WARNING) {
      this.thresholds.disk.warning = parseInt(process.env.METRICS_DISK_WARNING, 10);
    }
    if (process.env.METRICS_DISK_CRITICAL) {
      this.thresholds.disk.critical = parseInt(process.env.METRICS_DISK_CRITICAL, 10);
    }
    
    // Query time thresholds
    if (process.env.METRICS_QUERY_TIME_WARNING) {
      this.thresholds.queryTime.warning = parseInt(process.env.METRICS_QUERY_TIME_WARNING, 10);
    }
    if (process.env.METRICS_QUERY_TIME_CRITICAL) {
      this.thresholds.queryTime.critical = parseInt(process.env.METRICS_QUERY_TIME_CRITICAL, 10);
    }
  }

  /**
   * Start collecting metrics at regular intervals
   */
  startCollection(intervalMs: number = 30000): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
    }
    
    // Collect metrics immediately
    this.collectMetrics();
    
    // Set up interval for regular collection
    this.collectionInterval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);
    
    logger.info('Metrics collection started', { intervalMs });
  }

  /**
   * Stop collecting metrics
   */
  stopCollection(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }
    
    logger.info('Metrics collection stopped');
  }

  /**
   * Get the latest metrics
   */
  getMetrics(): SystemMetrics | null {
    return this.metrics;
  }

  /**
   * Set a custom metric
   */
  setCustomMetric(name: string, value: number): void {
    this.customMetrics[name] = value;
  }

  /**
   * Remove a custom metric
   */
  removeCustomMetric(name: string): boolean {
    if (name in this.customMetrics) {
      delete this.customMetrics[name];
      return true;
    }
    return false;
  }

  /**
   * Collect system metrics
   */
  private async collectMetrics(): Promise<void> {
    if (this.isCollecting) {
      return;
    }
    
    this.isCollecting = true;
    
    try {
      // Store previous metrics
      this.prevMetrics = this.metrics;
      
      // Calculate time since last update for rate calculations
      const now = Date.now();
      const timeDiffSeconds = (now - this.netStatsLastUpdate) / 1000;
      this.netStatsLastUpdate = now;
      
      // Collect current metrics
      const cpuUsage = await this.getCpuUsage();
      const memoryInfo = this.getMemoryInfo();
      const diskInfo = { total: 0, free: 0, used: 0, usagePercent: 0 }; // Placeholder
      const processInfo = this.getProcessInfo();
      const networkInfo = await this.getNetworkInfo(timeDiffSeconds);
      const databaseInfo = await this.getDatabaseInfo();
      
      // Create metrics object
      this.metrics = {
        timestamp: now,
        cpu: {
          usage: cpuUsage,
          loadAvg: os.loadavg(),
          count: os.cpus().length
        },
        memory: memoryInfo,
        disk: diskInfo,
        process: processInfo,
        network: networkInfo,
        database: databaseInfo,
        custom: { ...this.customMetrics }
      };
      
      // Emit metrics event
      this.emit('metrics', this.metrics);
      
      logger.debug('Metrics collected', { 
        cpu: this.metrics.cpu.usage, 
        memory: this.metrics.memory.usagePercent,
        queries: this.metrics.database.queryCount 
      });
    } catch (error: unknown) {
      logger.error('Error collecting metrics', { error: (error as Error).message });
    } finally {
      this.isCollecting = false;
    }
  }

  /**
   * Get CPU usage percentage
   */
  private async getCpuUsage(): Promise<number> {
    return new Promise<number>(resolve => {
      const startUsage = process.cpuUsage();
      
      // Measure CPU usage over a short period
      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const userCpuUsage = endUsage.user / 1000; // microseconds to milliseconds
        const sysCpuUsage = endUsage.system / 1000; // microseconds to milliseconds
        const totalCpuUsage = userCpuUsage + sysCpuUsage;
        
        // Calculate percentage based on all cores
        const cpuCount = os.cpus().length;
        const totalTime = 100 * cpuCount; // 100ms per core
        const cpuPercent = Math.min(100, (totalCpuUsage / totalTime) * 100);
        
        resolve(Number(cpuPercent.toFixed(2)));
      }, 100);
    });
  }

  /**
   * Get memory usage information
   */
  private getMemoryInfo(): SystemMetrics['memory'] {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const usagePercent = Number(((usedMem / totalMem) * 100).toFixed(2));
    
    return {
      total: totalMem,
      free: freeMem,
      used: usedMem,
      usagePercent
    };
  }

  /**
   * Get process information
   */
  private getProcessInfo(): SystemMetrics['process'] {
    const memoryUsage = process.memoryUsage();
    const activeHandles = (process as any)._getActiveHandles?.length || 0;
    const activeRequests = (process as any)._getActiveRequests?.length || 0;
    
    return {
      uptime: process.uptime(),
      memory: memoryUsage.rss,
      cpu: 0, // Will be calculated from CPU usage
      activeHandles,
      activeRequests
    };
  }

  /**
   * Get network information
   */
  private async getNetworkInfo(timeDiffSeconds: number): Promise<SystemMetrics['network']> {
    // This is a placeholder implementation
    // In a real system, you would track actual network metrics
    const bytesReceived = Math.floor(Math.random() * 1000000);
    const bytesSent = Math.floor(Math.random() * 1000000);
    const connections = Math.floor(Math.random() * 100);
    const requestCount = Math.floor(Math.random() * 1000);
    
    // Calculate rates
    const bytesReceivedRate = bytesReceived - this.bytesReceivedLast;
    const bytesSentRate = bytesSent - this.bytesSentLast;
    const requestsPerSecond = (requestCount - this.requestCountLast) / timeDiffSeconds;
    
    // Update last values
    this.bytesReceivedLast = bytesReceived;
    this.bytesSentLast = bytesSent;
    this.requestCountLast = requestCount;
    
    return {
      connections,
      bytesReceived: bytesReceivedRate,
      bytesSent: bytesSentRate,
      requestsPerSecond: Number(requestsPerSecond.toFixed(2))
    };
  }

  /**
   * Get database information
   */
  private async getDatabaseInfo(): Promise<SystemMetrics['database']> {
    try {
      // This assumes a DbConnectionManager with getPoolStats method
      // You'll need to adapt this to your actual database connection manager
      const dbStats = await (db as any).connectionManager?.getPoolStats?.() || {
        activeConnections: 0,
        queryCount: 0,
        avgQueryTimeMs: 0
      };
      
      return {
        connections: dbStats.activeConnections || 0,
        queryTime: dbStats.avgQueryTimeMs || 0,
        queryCount: dbStats.queryCount || 0
      };
    } catch (error: unknown) {
      logger.error('Error getting database metrics', { error: (error as Error).message });
      return {
        connections: 0,
        queryTime: 0,
        queryCount: 0
      };
    }
  }

  /**
   * Check metrics against thresholds and trigger alerts
   */
  private checkThresholds(metrics: SystemMetrics): void {
    // Check CPU usage
    if (metrics.cpu && typeof metrics.cpu.usage === 'number' && metrics.cpu.usage >= this.thresholds.cpu.critical) {
      this.triggerAlert('CPU usage critical', 
        `CPU usage is at ${metrics.cpu.usage}%, above critical threshold of ${this.thresholds.cpu.critical}%`, 
        AlertSeverity.CRITICAL, 'cpu');
    } else if (metrics.cpu && typeof metrics.cpu.usage === 'number' && metrics.cpu.usage >= this.thresholds.cpu.warning) {
      this.triggerAlert('CPU usage warning', 
        `CPU usage is at ${metrics.cpu.usage}%, above warning threshold of ${this.thresholds.cpu.warning}%`, 
        AlertSeverity.WARNING, 'cpu');
    }
    
    // Check memory usage
    if (metrics.memory && typeof metrics.memory.usagePercent === 'number' && metrics.memory.usagePercent >= this.thresholds.memory.critical) {
      this.triggerAlert('Memory usage critical', 
        `Memory usage is at ${metrics.memory.usagePercent}%, above critical threshold of ${this.thresholds.memory.critical}%`, 
        AlertSeverity.CRITICAL, 'memory');
    } else if (metrics.memory && typeof metrics.memory.usagePercent === 'number' && metrics.memory.usagePercent >= this.thresholds.memory.warning) {
      this.triggerAlert('Memory usage warning', 
        `Memory usage is at ${metrics.memory.usagePercent}%, above warning threshold of ${this.thresholds.memory.warning}%`, 
        AlertSeverity.WARNING, 'memory');
    }
    
    // Check disk usage
    if (metrics.disk && typeof metrics.disk.usagePercent === 'number' && metrics.disk.usagePercent >= this.thresholds.disk.critical) {
      this.triggerAlert('Disk usage critical', 
        `Disk usage is at ${metrics.disk.usagePercent}%, above critical threshold of ${this.thresholds.disk.critical}%`, 
        AlertSeverity.CRITICAL, 'disk');
    } else if (metrics.disk && typeof metrics.disk.usagePercent === 'number' && metrics.disk.usagePercent >= this.thresholds.disk.warning) {
      this.triggerAlert('Disk usage warning', 
        `Disk usage is at ${metrics.disk.usagePercent}%, above warning threshold of ${this.thresholds.disk.warning}%`, 
        AlertSeverity.WARNING, 'disk');
    }
    
    // Check query time
    if (metrics.database && typeof metrics.database.queryTime === 'number' && metrics.database.queryTime >= this.thresholds.queryTime.critical) {
      this.triggerAlert('Database query time critical', 
        `Average query time is ${metrics.database.queryTime}ms, above critical threshold of ${this.thresholds.queryTime.critical}ms`, 
        AlertSeverity.CRITICAL, 'database');
    } else if (metrics.database && typeof metrics.database.queryTime === 'number' && metrics.database.queryTime >= this.thresholds.queryTime.warning) {
      this.triggerAlert('Database query time warning', 
        `Average query time is ${metrics.database.queryTime}ms, above warning threshold of ${this.thresholds.queryTime.warning}ms`, 
        AlertSeverity.WARNING, 'database');
    }
  }

  /**
   * Trigger an alert
   */
  private triggerAlert(title: string, message: string, severity: AlertSeverity, source: string): void {
    alertManager.alert({
      title,
      message,
      severity,
      source: `metrics:${source}`,
      tags: {
        component: 'metrics',
        subsystem: source
      }
    });
  }

  /**
   * Configure thresholds
   */
  configureThresholds(thresholds: Partial<MetricsThresholds>): void {
    this.thresholds = {
      ...this.thresholds,
      ...thresholds
    };
    
    logger.info('Metrics thresholds configured');
  }

  /**
   * Gracefully shutdown the metrics collector
   */
  shutdown(): void {
    this.stopCollection();
  }
}

// Export singleton instance
export const metricsCollector = MetricsCollector.getInstance();
export default metricsCollector;
