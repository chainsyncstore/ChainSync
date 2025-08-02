import * as promClient from 'prom-client';
import axios from 'axios';
import { EventEmitter } from 'events';
import { getLogger } from '../../src/logging';

const logger = getLogger().child({ _component: 'production-monitor' });

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
  _id: string;
  _type: AlertType;
  _severity: AlertSeverity;
  _title: string;
  _message: string;
  _timestamp: Date;
  _metadata: Record<string, any>;
  _resolved: boolean;
  resolvedAt?: Date;
  _acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
}

// Health check result
export interface HealthCheckResult {
  _service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  _responseTime: number;
  _lastCheck: Date;
  error?: string;
  metadata?: Record<string, any>;
}

// Monitoring configuration
export interface MonitoringConfig {
  _healthCheckInterval: number;
  alertThresholds: {
    _errorRate: number;
    _responseTime: number;
    _cpuUsage: number;
    _memoryUsage: number;
    _diskUsage: number;
  };
  notificationChannels: {
    _email: boolean;
    _slack: boolean;
    _pagerDuty: boolean;
  };
  escalationPolicy: {
    _lowTimeout: number;
    _mediumTimeout: number;
    _highTimeout: number;
    _criticalTimeout: number;
  };
}

// Production monitoring system
export class ProductionMonitor extends EventEmitter {
  private _config: MonitoringConfig;
  private _alerts: Map<string, Alert> = new Map();
  private _healthChecks: Map<string, HealthCheckResult> = new Map();
  private metrics!: {
    _httpRequestDuration: promClient.Histogram;
    _httpRequestsTotal: promClient.Counter;
    _httpErrorsTotal: promClient.Counter;
    _systemCpuUsage: promClient.Gauge;
    _systemMemoryUsage: promClient.Gauge;
    _systemDiskUsage: promClient.Gauge;
    _databaseConnections: promClient.Gauge;
    _redisConnections: promClient.Gauge;
    _activeAlerts: promClient.Gauge;
  };

  constructor(_config: MonitoringConfig) {
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
      _httpRequestDuration: new promClient.Histogram({
        name: 'chainsync_http_request_duration_seconds',
        _help: 'Duration of HTTP requests in seconds',
        _labelNames: ['method', 'route', 'status_code'],
        _buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
      }),
      _httpRequestsTotal: new promClient.Counter({
        name: 'chainsync_http_requests_total',
        _help: 'Total number of HTTP requests',
        _labelNames: ['method', 'route', 'status_code']
      }),
      _httpErrorsTotal: new promClient.Counter({
        name: 'chainsync_http_errors_total',
        _help: 'Total number of HTTP errors',
        _labelNames: ['method', 'route', 'status_code', 'error_type']
      }),
      _systemCpuUsage: new promClient.Gauge({
        name: 'chainsync_system_cpu_usage_percent',
        _help: 'System CPU usage percentage'
      }),
      _systemMemoryUsage: new promClient.Gauge({
        name: 'chainsync_system_memory_usage_percent',
        _help: 'System memory usage percentage'
      }),
      _systemDiskUsage: new promClient.Gauge({
        name: 'chainsync_system_disk_usage_percent',
        _help: 'System disk usage percentage'
      }),
      _databaseConnections: new promClient.Gauge({
        name: 'chainsync_database_connections',
        _help: 'Number of active database connections'
      }),
      _redisConnections: new promClient.Gauge({
        name: 'chainsync_redis_connections',
        _help: 'Number of active Redis connections'
      }),
      _activeAlerts: new promClient.Gauge({
        name: 'chainsync_active_alerts',
        _help: 'Number of active alerts',
        _labelNames: ['severity']
      })
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
      { _name: 'api', _url: '/api/health' },
      { _name: 'database', _url: '/api/health/database' },
      { _name: 'redis', _url: '/api/health/redis' },
      { _name: 'external-api', _url: '/api/health/external' }
    ];

    for (const service of services) {
      try {
        const startTime = Date.now();
        const response = await axios.get(service.url, { _timeout: 5000 });
        const responseTime = Date.now() - startTime;

        const _result: HealthCheckResult = {
          _service: service.name,
          _status: response.status === 200 ? 'healthy' : 'unhealthy',
          responseTime,
          _lastCheck: new Date(),
          _metadata: response.data
        };

        this.healthChecks.set(service.name, result);

        // Check for performance issues
        if (responseTime > this.config.alertThresholds.responseTime) {
          this.createAlert({
            _type: AlertType.HIGH_LATENCY,
            _severity: AlertSeverity.MEDIUM,
            _title: `High latency detected for ${service.name}`,
            _message: `Response time ${responseTime}ms exceeds threshold ${this.config.alertThresholds.responseTime}ms`,
            _metadata: { _service: service.name, responseTime, _threshold: this.config.alertThresholds.responseTime }
          });
        }

      } catch (error) {
        const _result: HealthCheckResult = {
          _service: service.name,
          _status: 'unhealthy',
          _responseTime: 0,
          _lastCheck: new Date(),
          _error: error instanceof Error ? error.message : 'Unknown error'
        };

        this.healthChecks.set(service.name, result);

        // Create alert for service down
        this.createAlert({
          _type: AlertType.SYSTEM_DOWN,
          _severity: AlertSeverity.HIGH,
          _title: `${service.name} service is down`,
          _message: `Health check failed for ${service.name}: ${result.error}`,
          _metadata: { _service: service.name, _error: result.error }
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
          _type: AlertType.HIGH_LATENCY,
          _severity: AlertSeverity.MEDIUM,
          _title: 'High CPU usage detected',
          _message: `CPU usage ${cpuUsage}% exceeds threshold ${this.config.alertThresholds.cpuUsage}%`,
          _metadata: { cpuUsage, _threshold: this.config.alertThresholds.cpuUsage }
        });
      }

      // Collect memory usage
      const memoryUsage = await this.getMemoryUsage();
      this.metrics.systemMemoryUsage.set(memoryUsage);

      if (memoryUsage > this.config.alertThresholds.memoryUsage) {
        this.createAlert({
          _type: AlertType.MEMORY_LOW,
          _severity: AlertSeverity.HIGH,
          _title: 'High memory usage detected',
          _message: `Memory usage ${memoryUsage}% exceeds threshold ${this.config.alertThresholds.memoryUsage}%`,
          _metadata: { memoryUsage, _threshold: this.config.alertThresholds.memoryUsage }
        });
      }

      // Collect disk usage
      const diskUsage = await this.getDiskUsage();
      this.metrics.systemDiskUsage.set(diskUsage);

      if (diskUsage > this.config.alertThresholds.diskUsage) {
        this.createAlert({
          _type: AlertType.DISK_SPACE_LOW,
          _severity: AlertSeverity.HIGH,
          _title: 'Low disk space detected',
          _message: `Disk usage ${diskUsage}% exceeds threshold ${this.config.alertThresholds.diskUsage}%`,
          _metadata: { diskUsage, _threshold: this.config.alertThresholds.diskUsage }
        });
      }

    } catch (error) {
      logger.error('Failed to collect system metrics', { error });
    }
  }

  /**
   * Create an alert
   */
  createAlert(_alertData: Omit<Alert, 'id' | 'timestamp' | 'resolved' | 'acknowledged'>): void {
    const _alert: Alert = {
      ...alertData,
      _id: this.generateAlertId(),
      _timestamp: new Date(),
      _resolved: false,
      _acknowledged: false
    };

    this.alerts.set(alert.id, alert);
    this.metrics.activeAlerts.inc({ _severity: alert.severity });

    logger.warn('Alert created', { alert });
    this.emit('alert', alert);

    // Send notifications
    this.sendNotifications(alert);
  }

  /**
   * Resolve an alert
   */
  resolveAlert(_alertId: string, resolvedBy?: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.resolved = true;
    alert.resolvedAt = new Date();
    this.metrics.activeAlerts.dec({ _severity: alert.severity });

    logger.info('Alert resolved', { alertId, resolvedBy });
    this.emit('alertResolved', alert);

    return true;
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(_alertId: string, _acknowledgedBy: string): boolean {
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
  private escalateAlert(_alert: Alert): void {
    logger.warn('Alert escalated', { _alertId: alert.id, _severity: alert.severity });
    this.emit('alertEscalated', alert);

    // Send escalation notifications
    this.sendEscalationNotifications(alert);
  }

  /**
   * Get escalation timeout for severity
   */
  private getEscalationTimeout(_severity: AlertSeverity): number {
    switch (severity) {
      case AlertSeverity._LOW:
        return this.config.escalationPolicy.lowTimeout;
      case AlertSeverity._MEDIUM:
        return this.config.escalationPolicy.mediumTimeout;
      case AlertSeverity._HIGH:
        return this.config.escalationPolicy.highTimeout;
      case AlertSeverity._CRITICAL:
        return this.config.escalationPolicy.criticalTimeout;
      return 300000; // 5 minutes default
    }
  }

  /**
   * Send notifications
   */
  private async sendNotifications(_alert: Alert): Promise<void> {
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
      logger.error('Failed to send notifications', { error, _alertId: alert.id });
    }
  }

  /**
   * Send escalation notifications
   */
  private async sendEscalationNotifications(_alert: Alert): Promise<void> {
    // Implementation for escalation notifications
    logger.info('Sending escalation notifications', { _alertId: alert.id });
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(_alert: Alert): Promise<void> {
    // Implementation for email notifications
    logger.info('Sending email notification', { _alertId: alert.id });
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(_alert: Alert): Promise<void> {
    // Implementation for Slack notifications
    logger.info('Sending Slack notification', { _alertId: alert.id });
  }

  /**
   * Send PagerDuty notification
   */
  private async sendPagerDutyNotification(_alert: Alert): Promise<void> {
    // Implementation for PagerDuty notifications
    logger.info('Sending PagerDuty notification', { _alertId: alert.id });
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
  async getMetrics(): Promise<string> {
    return await promClient.register.metrics();
  }
}
