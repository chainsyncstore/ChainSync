import * as promClient from 'prom-client';
import axios from 'axios';
import { EventEmitter } from 'events';
import { getLogger } from '../../src/logging';

const logger = getLogger().child({ component: 'production-monitor' });

// Alert severity levels
export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Alert types
export enum AlertType {
  SYSTEM_DOWN = 'system_down',
  HIGH_ERROR_RATE = 'high_error_rate',
  HIGH_LATENCY = 'high_latency',
  DISK_SPACE_LOW = 'disk_space_low',
  MEMORY_LOW = 'memory_low',
  DATABASE_CONNECTION_ISSUE = 'database_connection_issue',
  REDIS_CONNECTION_ISSUE = 'redis_connection_issue',
  SSL_CERTIFICATE_EXPIRING = 'ssl_certificate_expiring',
  BACKUP_FAILURE = 'backup_failure',
  SECURITY_BREACH = 'security_breach',
}

// Alert interface
export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  timestamp: Date;
  metadata: Record<string, any>;
  resolved: boolean;
  resolvedAt?: Date;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
}

// Health check result
export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  lastCheck: Date;
  error?: string;
  metadata?: Record<string, any>;
}

// Monitoring configuration
export interface MonitoringConfig {
  healthCheckInterval: number;
  alertThresholds: {
    errorRate: number;
    responseTime: number;
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
  };
  notificationChannels: {
    email: boolean;
    slack: boolean;
    pagerDuty: boolean;
  };
  escalationPolicy: {
    lowTimeout: number;
    mediumTimeout: number;
    highTimeout: number;
    criticalTimeout: number;
  };
}

// Production monitoring system
export class ProductionMonitor extends EventEmitter {
  private config: MonitoringConfig;
  private alerts: Map<string, Alert> = new Map();
  private healthChecks: Map<string, HealthCheckResult> = new Map();
  private metrics: {
    httpRequestDuration: promClient.Histogram;
    httpRequestsTotal: promClient.Counter;
    httpErrorsTotal: promClient.Counter;
    systemCpuUsage: promClient.Gauge;
    systemMemoryUsage: promClient.Gauge;
    systemDiskUsage: promClient.Gauge;
    databaseConnections: promClient.Gauge;
    redisConnections: promClient.Gauge;
    activeAlerts: promClient.Gauge;
  };

  constructor(config: MonitoringConfig) {
    super();
    this.config = config;
    this.initializeMetrics();
    this.startMonitoring();
  }

  /**
   * Initialize Prometheus metrics
   */
  private initializeMetrics(): void {
    this.metrics = {
      httpRequestDuration: new promClient.Histogram({
        name: 'chainsync_http_request_duration_seconds',
        help: 'Duration of HTTP requests in seconds',
        labelNames: ['method', 'route', 'status_code'],
        buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
      }),
      httpRequestsTotal: new promClient.Counter({
        name: 'chainsync_http_requests_total',
        help: 'Total number of HTTP requests',
        labelNames: ['method', 'route', 'status_code'],
      }),
      httpErrorsTotal: new promClient.Counter({
        name: 'chainsync_http_errors_total',
        help: 'Total number of HTTP errors',
        labelNames: ['method', 'route', 'status_code', 'error_type'],
      }),
      systemCpuUsage: new promClient.Gauge({
        name: 'chainsync_system_cpu_usage_percent',
        help: 'System CPU usage percentage',
      }),
      systemMemoryUsage: new promClient.Gauge({
        name: 'chainsync_system_memory_usage_percent',
        help: 'System memory usage percentage',
      }),
      systemDiskUsage: new promClient.Gauge({
        name: 'chainsync_system_disk_usage_percent',
        help: 'System disk usage percentage',
      }),
      databaseConnections: new promClient.Gauge({
        name: 'chainsync_database_connections',
        help: 'Number of active database connections',
      }),
      redisConnections: new promClient.Gauge({
        name: 'chainsync_redis_connections',
        help: 'Number of active Redis connections',
      }),
      activeAlerts: new promClient.Gauge({
        name: 'chainsync_active_alerts',
        help: 'Number of active alerts',
        labelNames: ['severity'],
      }),
    };
  }

  /**
   * Start monitoring
   */
  private startMonitoring(): void {
    // Start health checks
    setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheckInterval);

    // Start system metrics collection
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30000); // Every 30 seconds

    // Start alert escalation checks
    setInterval(() => {
      this.checkAlertEscalations();
    }, 60000); // Every minute

    logger.info('Production monitoring started');
  }

  /**
   * Perform health checks
   */
  private async performHealthChecks(): Promise<void> {
    const services = [
      { name: 'api', url: '/api/health' },
      { name: 'database', url: '/api/health/database' },
      { name: 'redis', url: '/api/health/redis' },
      { name: 'external-api', url: '/api/health/external' },
    ];

    for (const service of services) {
      try {
        const startTime = Date.now();
        const response = await axios.get(service.url, { timeout: 5000 });
        const responseTime = Date.now() - startTime;

        const result: HealthCheckResult = {
          service: service.name,
          status: response.status === 200 ? 'healthy' : 'unhealthy',
          responseTime,
          lastCheck: new Date(),
          metadata: response.data,
        };

        this.healthChecks.set(service.name, result);

        // Check for performance issues
        if (responseTime > this.config.alertThresholds.responseTime) {
          this.createAlert({
            type: AlertType.HIGH_LATENCY,
            severity: AlertSeverity.MEDIUM,
            title: `High latency detected for ${service.name}`,
            message: `Response time ${responseTime}ms exceeds threshold ${this.config.alertThresholds.responseTime}ms`,
            metadata: { service: service.name, responseTime, threshold: this.config.alertThresholds.responseTime },
          });
        }

      } catch (error) {
        const result: HealthCheckResult = {
          service: service.name,
          status: 'unhealthy',
          responseTime: 0,
          lastCheck: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error',
        };

        this.healthChecks.set(service.name, result);

        // Create alert for service down
        this.createAlert({
          type: AlertType.SYSTEM_DOWN,
          severity: AlertSeverity.HIGH,
          title: `${service.name} service is down`,
          message: `Health check failed for ${service.name}: ${result.error}`,
          metadata: { service: service.name, error: result.error },
        });
      }
    }
  }

  /**
   * Collect system metrics
   */
  private async collectSystemMetrics(): Promise<void> {
    try {
      // Collect CPU usage
      const cpuUsage = await this.getCpuUsage();
      this.metrics.systemCpuUsage.set(cpuUsage);

      if (cpuUsage > this.config.alertThresholds.cpuUsage) {
        this.createAlert({
          type: AlertType.HIGH_LATENCY,
          severity: AlertSeverity.MEDIUM,
          title: 'High CPU usage detected',
          message: `CPU usage ${cpuUsage}% exceeds threshold ${this.config.alertThresholds.cpuUsage}%`,
          metadata: { cpuUsage, threshold: this.config.alertThresholds.cpuUsage },
        });
      }

      // Collect memory usage
      const memoryUsage = await this.getMemoryUsage();
      this.metrics.systemMemoryUsage.set(memoryUsage);

      if (memoryUsage > this.config.alertThresholds.memoryUsage) {
        this.createAlert({
          type: AlertType.MEMORY_LOW,
          severity: AlertSeverity.HIGH,
          title: 'High memory usage detected',
          message: `Memory usage ${memoryUsage}% exceeds threshold ${this.config.alertThresholds.memoryUsage}%`,
          metadata: { memoryUsage, threshold: this.config.alertThresholds.memoryUsage },
        });
      }

      // Collect disk usage
      const diskUsage = await this.getDiskUsage();
      this.metrics.systemDiskUsage.set(diskUsage);

      if (diskUsage > this.config.alertThresholds.diskUsage) {
        this.createAlert({
          type: AlertType.DISK_SPACE_LOW,
          severity: AlertSeverity.HIGH,
          title: 'Low disk space detected',
          message: `Disk usage ${diskUsage}% exceeds threshold ${this.config.alertThresholds.diskUsage}%`,
          metadata: { diskUsage, threshold: this.config.alertThresholds.diskUsage },
        });
      }

    } catch (error) {
      logger.error('Failed to collect system metrics', { error });
    }
  }

  /**
   * Create an alert
   */
  createAlert(alertData: Omit<Alert, 'id' | 'timestamp' | 'resolved' | 'acknowledged'>): void {
    const alert: Alert = {
      ...alertData,
      id: this.generateAlertId(),
      timestamp: new Date(),
      resolved: false,
      acknowledged: false,
    };

    this.alerts.set(alert.id, alert);
    this.metrics.activeAlerts.inc({ severity: alert.severity });

    logger.warn('Alert created', { alert });
    this.emit('alert', alert);

    // Send notifications
    this.sendNotifications(alert);
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string, resolvedBy?: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.resolved = true;
    alert.resolvedAt = new Date();
    this.metrics.activeAlerts.dec({ severity: alert.severity });

    logger.info('Alert resolved', { alertId, resolvedBy });
    this.emit('alertResolved', alert);

    return true;
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.acknowledged = true;
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = acknowledgedBy;

    logger.info('Alert acknowledged', { alertId, acknowledgedBy });
    this.emit('alertAcknowledged', alert);

    return true;
  }

  /**
   * Check alert escalations
   */
  private checkAlertEscalations(): void {
    const now = new Date();

    for (const alert of this.alerts.values()) {
      if (alert.resolved || alert.acknowledged) {
        continue;
      }

      const timeSinceCreation = now.getTime() - alert.timestamp.getTime();
      const escalationTimeout = this.getEscalationTimeout(alert.severity);

      if (timeSinceCreation > escalationTimeout) {
        this.escalateAlert(alert);
      }
    }
  }

  /**
   * Escalate an alert
   */
  private escalateAlert(alert: Alert): void {
    logger.warn('Alert escalated', { alertId: alert.id, severity: alert.severity });
    this.emit('alertEscalated', alert);

    // Send escalation notifications
    this.sendEscalationNotifications(alert);
  }

  /**
   * Get escalation timeout for severity
   */
  private getEscalationTimeout(severity: AlertSeverity): number {
    switch (severity) {
      case AlertSeverity.LOW:
        return this.config.escalationPolicy.lowTimeout;
      case AlertSeverity.MEDIUM:
        return this.config.escalationPolicy.mediumTimeout;
      case AlertSeverity.HIGH:
        return this.config.escalationPolicy.highTimeout;
      case AlertSeverity.CRITICAL:
        return this.config.escalationPolicy.criticalTimeout;
      default:
        return 300000; // 5 minutes default
    }
  }

  /**
   * Send notifications
   */
  private async sendNotifications(alert: Alert): Promise<void> {
    try {
      if (this.config.notificationChannels.email) {
        await this.sendEmailNotification(alert);
      }

      if (this.config.notificationChannels.slack) {
        await this.sendSlackNotification(alert);
      }

      if (this.config.notificationChannels.pagerDuty && alert.severity === AlertSeverity.CRITICAL) {
        await this.sendPagerDutyNotification(alert);
      }
    } catch (error) {
      logger.error('Failed to send notifications', { error, alertId: alert.id });
    }
  }

  /**
   * Send escalation notifications
   */
  private async sendEscalationNotifications(alert: Alert): Promise<void> {
    // Implementation for escalation notifications
    logger.info('Sending escalation notifications', { alertId: alert.id });
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(alert: Alert): Promise<void> {
    // Implementation for email notifications
    logger.info('Sending email notification', { alertId: alert.id });
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(alert: Alert): Promise<void> {
    // Implementation for Slack notifications
    logger.info('Sending Slack notification', { alertId: alert.id });
  }

  /**
   * Send PagerDuty notification
   */
  private async sendPagerDutyNotification(alert: Alert): Promise<void> {
    // Implementation for PagerDuty notifications
    logger.info('Sending PagerDuty notification', { alertId: alert.id });
  }

  /**
   * Get CPU usage
   */
  private async getCpuUsage(): Promise<number> {
    // Implementation to get CPU usage
    // This would use os.cpus() or a system monitoring library
    return Math.random() * 100; // Placeholder
  }

  /**
   * Get memory usage
   */
  private async getMemoryUsage(): Promise<number> {
    // Implementation to get memory usage
    // This would use os.freemem() and os.totalmem()
    return Math.random() * 100; // Placeholder
  }

  /**
   * Get disk usage
   */
  private async getDiskUsage(): Promise<number> {
    // Implementation to get disk usage
    // This would use fs.statfs() or a system monitoring library
    return Math.random() * 100; // Placeholder
  }

  /**
   * Generate alert ID
   */
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get all alerts
   */
  getAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return this.getAlerts().filter(alert => !alert.resolved);
  }

  /**
   * Get health check results
   */
  getHealthChecks(): HealthCheckResult[] {
    return Array.from(this.healthChecks.values());
  }

  /**
   * Get metrics
   */
  getMetrics(): string {
    return promClient.register.metrics();
  }
} 