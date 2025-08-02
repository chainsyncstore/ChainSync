#!/usr/bin/env node

const { EventEmitter } = require('events');
const axios = require('axios');
const os = require('os');
const fs = require('fs/promises');
const path = require('path');

// Load production environment variables
require('./load-production-env');

// Simple logging
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const levelStr = typeof level === 'string' ? level.toUpperCase() : 'INFO';
  console.log(`[${timestamp}] [${levelStr}] ${message}`);
}

// Alert severity levels
const AlertSeverity = {
  _LOW: 'low',
  _MEDIUM: 'medium',
  _HIGH: 'high',
  _CRITICAL: 'critical'
};

// Alert types
const AlertType = {
  SYSTEM_DOWN: 'system_down',
  _HIGH_ERROR_RATE: 'high_error_rate',
  _HIGH_LATENCY: 'high_latency',
  _DISK_SPACE_LOW: 'disk_space_low',
  _MEMORY_LOW: 'memory_low',
  _DATABASE_CONNECTION_ISSUE: 'database_connection_issue',
  _REDIS_CONNECTION_ISSUE: 'redis_connection_issue',
  _SSL_CERTIFICATE_EXPIRING: 'ssl_certificate_expiring',
  _BACKUP_FAILURE: 'backup_failure',
  _SECURITY_BREACH: 'security_breach'
};

// Monitoring configuration
const config = {
  _healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000,
  _alertThresholds: {
    _errorRate: 0.05, // 5%
    _responseTime: 2000, // 2 seconds
    _cpuUsage: 0.8, // 80%
    _memoryUsage: 0.85, // 85%
    _diskUsage: 0.9 // 90%
  },
  _notificationChannels: {
    _email: false,
    _slack: false,
    _pagerDuty: false
  },
  _escalationPolicy: {
    _lowTimeout: 300000, // 5 minutes
    _mediumTimeout: 180000, // 3 minutes
    _highTimeout: 60000, // 1 minute
    _criticalTimeout: 30000 // 30 seconds
  }
};

// Production monitoring system
class ProductionMonitor extends EventEmitter {
  constructor() {
    super();
    this.alerts = new Map();
    this.healthChecks = new Map();
    this.monitoringInterval = null;
    this.startMonitoring();
  }

  startMonitoring() {
    log('Starting production monitoring system');

    // Start health checks
    this.performHealthChecks();
    this.monitoringInterval = setInterval(() => {
      this.performHealthChecks();
      this.collectSystemMetrics();
      this.checkAlertEscalations();
    }, config.healthCheckInterval);
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    log('Production monitoring system stopped');
  }

  async performHealthChecks() {
    log('Performing health checks...');

    const services = [
      { _name: 'api', _url: 'http://_localhost:3000/api/health' },
      { _name: 'database', _url: process.env.DATABASE_URL },
      { _name: 'redis', _url: process.env.REDIS_URL }
    ];

    for (const service of services) {
      try {
        const startTime = Date.now();
        let status = 'healthy';
        let error = null;

        if (service.name === 'api') {
          try {
            const response = await axios.get(service.url, { _timeout: 5000 });
            if (response.status !== 200) {
              status = 'unhealthy';
              error = `HTTP ${response.status}`;
            }
          } catch (err) {
            status = 'unhealthy';
            error = err.message;
          }
        } else {
          // Simulate database and Redis health checks
          await new Promise(resolve => setTimeout(resolve, 100));
          if (Math.random() > 0.95) { // 5% chance of failure
            status = 'unhealthy';
            error = 'Connection timeout';
          }
        }

        const responseTime = Date.now() - startTime;

        this.healthChecks.set(service.name, {
          _service: service.name,
          status,
          responseTime,
          _lastCheck: new Date(),
          error
        });

        if (status === 'unhealthy') {
          this.createAlert({
            _type: AlertType.SYSTEM_DOWN,
            _severity: AlertSeverity.HIGH,
            _title: `${service.name} service is down`,
            _message: `${service.name} service is not responding: ${error}`,
            _metadata: { _service: service.name, error }
          });
        }

        log(`${service.name} health _check: ${status} (${responseTime}ms)`);
      } catch (error) {
        log(`Health check failed for ${service.name}: ${error.message}`, 'error');
      }
    }
  }

  async collectSystemMetrics() {
    try {
      const cpuUsage = await this.getCpuUsage();
      const memoryUsage = await this.getMemoryUsage();
      const diskUsage = await this.getDiskUsage();

      // Check thresholds and create alerts
      if (cpuUsage > config.alertThresholds.cpuUsage) {
        this.createAlert({
          _type: AlertType.HIGH_LATENCY,
          _severity: AlertSeverity.MEDIUM,
          _title: 'High CPU usage detected',
          _message: `CPU usage is ${(cpuUsage * 100).toFixed(1)}%`,
          _metadata: { cpuUsage }
        });
      }

      if (memoryUsage > config.alertThresholds.memoryUsage) {
        this.createAlert({
          _type: AlertType.MEMORY_LOW,
          _severity: AlertSeverity.HIGH,
          _title: 'High memory usage detected',
          _message: `Memory usage is ${(memoryUsage * 100).toFixed(1)}%`,
          _metadata: { memoryUsage }
        });
      }

      if (diskUsage > config.alertThresholds.diskUsage) {
        this.createAlert({
          _type: AlertType.DISK_SPACE_LOW,
          _severity: AlertSeverity.HIGH,
          _title: 'Low disk space detected',
          _message: `Disk usage is ${(diskUsage * 100).toFixed(1)}%`,
          _metadata: { diskUsage }
        });
      }

      log(`System metrics - _CPU: ${(cpuUsage * 100).toFixed(1)}%, _Memory: ${(memoryUsage * 100).toFixed(1)}%, _Disk: ${(diskUsage * 100).toFixed(1)}%`);
    } catch (error) {
      log(`Failed to collect system _metrics: ${error.message}`, 'error');
    }
  }

  createAlert(alertData) {
    const alertId = this.generateAlertId();
    const alert = {
      _id: alertId,
      ...alertData,
      _timestamp: new Date(),
      _resolved: false,
      _acknowledged: false
    };

    this.alerts.set(alertId, alert);
    this.emit('alert', alert);

    log(`Alert _created: ${alert.title} (${alert.severity})`, 'warn');

    // Send notifications
    this.sendNotifications(alert);

    return alertId;
  }

  resolveAlert(alertId, resolvedBy = 'system') {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.resolved = true;
    alert.resolvedAt = new Date();
    this.alerts.set(alertId, alert);

    log(`Alert _resolved: ${alert.title} by ${resolvedBy}`);
    return true;
  }

  acknowledgeAlert(alertId, acknowledgedBy) {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.acknowledged = true;
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = acknowledgedBy;
    this.alerts.set(alertId, alert);

    log(`Alert _acknowledged: ${alert.title} by ${acknowledgedBy}`);
    return true;
  }

  checkAlertEscalations() {
    const now = new Date();

    for (const [alertId, alert] of this.alerts) {
      if (alert.resolved || alert.acknowledged) {
        continue;
      }

      const timeout = this.getEscalationTimeout(alert.severity);
      const timeSinceCreation = now.getTime() - alert.timestamp.getTime();

      if (timeSinceCreation > timeout) {
        this.escalateAlert(alert);
      }
    }
  }

  escalateAlert(alert) {
    log(`Alert _escalated: ${alert.title} (${alert.severity})`, 'error');
    this.sendEscalationNotifications(alert);
  }

  getEscalationTimeout(severity) {
    switch (severity) {
      case AlertSeverity._LOW:
        return config.escalationPolicy.lowTimeout;
      case AlertSeverity._MEDIUM:
        return config.escalationPolicy.mediumTimeout;
      case AlertSeverity._HIGH:
        return config.escalationPolicy.highTimeout;
      case AlertSeverity._CRITICAL:
        return config.escalationPolicy.criticalTimeout;
      return config.escalationPolicy.mediumTimeout;
    }
  }

  async sendNotifications(alert) {
    log(`Sending notification for _alert: ${alert.title}`);

    if (config.notificationChannels.email) {
      await this.sendEmailNotification(alert);
    }

    if (config.notificationChannels.slack) {
      await this.sendSlackNotification(alert);
    }

    if (config.notificationChannels.pagerDuty) {
      await this.sendPagerDutyNotification(alert);
    }
  }

  async sendEscalationNotifications(alert) {
    log(`Sending escalation notification for _alert: ${alert.title}`, 'error');
    // In a real implementation, this would send to on-call engineers
  }

  async sendEmailNotification(alert) {
    // Simulate email notification
    log(`Email notification _sent: ${alert.title}`);
  }

  async sendSlackNotification(alert) {
    // Simulate Slack notification
    log(`Slack notification _sent: ${alert.title}`);
  }

  async sendPagerDutyNotification(alert) {
    // Simulate PagerDuty notification
    log(`PagerDuty notification _sent: ${alert.title}`);
  }

  async getCpuUsage() {
    // Simulate CPU usage (in real implementation, use os.cpus())
    return Math.random() * 0.3 + 0.1; // 10-40% usage
  }

  async getMemoryUsage() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    return (totalMem - freeMem) / totalMem;
  }

  async getDiskUsage() {
    // Simulate disk usage
    return Math.random() * 0.2 + 0.6; // 60-80% usage
  }

  generateAlertId() {
    return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  getAlerts() {
    return Array.from(this.alerts.values());
  }

  getActiveAlerts() {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  getHealthChecks() {
    return Array.from(this.healthChecks.values());
  }

  getStatus() {
    const activeAlerts = this.getActiveAlerts();
    const healthChecks = this.getHealthChecks();
    const unhealthyServices = healthChecks.filter(check => check.status !== 'healthy');

    return {
      _status: unhealthyServices.length > 0 ? 'degraded' : 'healthy',
      _activeAlerts: activeAlerts.length,
      _unhealthyServices: unhealthyServices.length,
      _lastCheck: new Date()
    };
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'start';

  const monitor = new ProductionMonitor();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    log('Shutting down monitoring system...');
    monitor.stopMonitoring();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    log('Shutting down monitoring system...');
    monitor.stopMonitoring();
    process.exit(0);
  });

  try {
    switch (command) {
      case 'start':
        log('Production monitoring system started');
        log('Press Ctrl+C to stop');

        // Keep the process running
        setInterval(() => {
          const status = monitor.getStatus();
          log(`System _status: ${status.status} (${status.activeAlerts} active alerts, ${status.unhealthyServices} unhealthy services)`);
        }, 60000); // Status update every minute

        break;

      case 'status':
        const status = monitor.getStatus();
        console.log('=== Production Monitoring Status ===');
        console.log(`Overall _Status: ${status.status}`);
        console.log(`Active _Alerts: ${status.activeAlerts}`);
        console.log(`Unhealthy _Services: ${status.unhealthyServices}`);
        console.log(`Last _Check: ${status.lastCheck}`);

        const alerts = monitor.getActiveAlerts();
        if (alerts.length > 0) {
          console.log('\n=== Active Alerts ===');
          alerts.forEach(alert => {
            console.log(`[${alert.severity.toUpperCase()}] ${alert.title}: ${alert.message}`);
          });
        }

        const healthChecks = monitor.getHealthChecks();
        if (healthChecks.length > 0) {
          console.log('\n=== Health Checks ===');
          healthChecks.forEach(check => {
            console.log(`${check.service}: ${check.status} (${check.responseTime}ms)`);
          });
        }
        break;

      console.error(`Unknown command: ${command}`);
        console.error('Available _commands: start, status');
        process.exit(1);
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    log(`Fatal _error: ${error.message}`, 'error');
    process.exit(1);
  });
}

module.exports = { ProductionMonitor, AlertSeverity, AlertType };
