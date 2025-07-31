import { EventEmitter } from 'events';
import { getLogger } from '../../src/logging';

const logger = getLogger().child({ component: 'alert-manager' });

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

// Alert rule interface
export interface AlertRule {
  id: string;
  name: string;
  type: AlertType;
  severity: AlertSeverity;
  condition: string;
  threshold: number;
  enabled: boolean;
  cooldown: number; // seconds
  lastTriggered?: Date;
}

// Alert manager
export class AlertManager extends EventEmitter {
  private alerts: Map<string, Alert> = new Map();
  private rules: Map<string, AlertRule> = new Map();
  private cooldowns: Map<string, Date> = new Map();

  constructor() {
    super();
    this.initializeDefaultRules();
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        type: AlertType.HIGH_ERROR_RATE,
        severity: AlertSeverity.HIGH,
        condition: 'error_rate > threshold',
        threshold: 5, // 5% error rate
        enabled: true,
        cooldown: 300, // 5 minutes
      },
      {
        id: 'high_latency',
        name: 'High Latency',
        type: AlertType.HIGH_LATENCY,
        severity: AlertSeverity.MEDIUM,
        condition: 'response_time > threshold',
        threshold: 2000, // 2 seconds
        enabled: true,
        cooldown: 180, // 3 minutes
      },
      {
        id: 'disk_space_low',
        name: 'Low Disk Space',
        type: AlertType.DISK_SPACE_LOW,
        severity: AlertSeverity.HIGH,
        condition: 'disk_usage > threshold',
        threshold: 85, // 85% usage
        enabled: true,
        cooldown: 600, // 10 minutes
      },
      {
        id: 'memory_low',
        name: 'Low Memory',
        type: AlertType.MEMORY_LOW,
        severity: AlertSeverity.HIGH,
        condition: 'memory_usage > threshold',
        threshold: 90, // 90% usage
        enabled: true,
        cooldown: 300, // 5 minutes
      },
    ];

    for (const rule of defaultRules) {
      this.rules.set(rule.id, rule);
    }

    logger.info('Default alert rules initialized');
  }

  /**
   * Add alert rule
   */
  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    logger.info('Alert rule added', { ruleId: rule.id, ruleName: rule.name });
  }

  /**
   * Remove alert rule
   */
  removeRule(ruleId: string): boolean {
    const removed = this.rules.delete(ruleId);
    if (removed) {
      logger.info('Alert rule removed', { ruleId });
    }
    return removed;
  }

  /**
   * Enable/disable alert rule
   */
  setRuleEnabled(ruleId: string, enabled: boolean): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      return false;
    }

    rule.enabled = enabled;
    logger.info('Alert rule enabled/disabled', { ruleId, enabled });
    return true;
  }

  /**
   * Evaluate alert rules
   */
  evaluateRules(metrics: Record<string, number>): void {
    for (const rule of this.rules.values()) {
      if (!rule.enabled) {
        continue;
      }

      // Check cooldown
      const lastTriggered = this.cooldowns.get(rule.id);
      if (lastTriggered) {
        const timeSinceLastTrigger = Date.now() - lastTriggered.getTime();
        if (timeSinceLastTrigger < rule.cooldown * 1000) {
          continue;
        }
      }

      // Evaluate condition
      if (this.evaluateCondition(rule, metrics)) {
        this.triggerAlert(rule, metrics);
        this.cooldowns.set(rule.id, new Date());
      }
    }
  }

  /**
   * Evaluate alert condition
   */
  private evaluateCondition(rule: AlertRule, metrics: Record<string, number>): boolean {
    const value = metrics[rule.condition.split('>')[0].trim()];
    if (value === undefined) {
      return false;
    }

    return value > rule.threshold;
  }

  /**
   * Trigger alert
   */
  private triggerAlert(rule: AlertRule, metrics: Record<string, number>): void {
    const alert: Alert = {
      id: this.generateAlertId(),
      type: rule.type,
      severity: rule.severity,
      title: `${rule.name} Alert`,
      message: `Condition "${rule.condition}" exceeded threshold ${rule.threshold}`,
      timestamp: new Date(),
      metadata: {
        ruleId: rule.id,
        ruleName: rule.name,
        condition: rule.condition,
        threshold: rule.threshold,
        currentValue: metrics[rule.condition.split('>')[0].trim()],
        metrics,
      },
      resolved: false,
      acknowledged: false,
    };

    this.alerts.set(alert.id, alert);
    rule.lastTriggered = new Date();

    logger.warn('Alert triggered', { alertId: alert.id, ruleId: rule.id });
    this.emit('alert', alert);
  }

  /**
   * Create manual alert
   */
  createAlert(alertData: Omit<Alert, 'id' | 'timestamp' | 'resolved' | 'acknowledged'>): string {
    const alert: Alert = {
      ...alertData,
      id: this.generateAlertId(),
      timestamp: new Date(),
      resolved: false,
      acknowledged: false,
    };

    this.alerts.set(alert.id, alert);
    logger.info('Manual alert created', { alertId: alert.id });
    this.emit('alert', alert);

    return alert.id;
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string, resolvedBy?: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.resolved = true;
    alert.resolvedAt = new Date();

    logger.info('Alert resolved', { alertId, resolvedBy });
    this.emit('alertResolved', alert);

    return true;
  }

  /**
   * Acknowledge alert
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
   * Get alerts by severity
   */
  getAlertsBySeverity(severity: AlertSeverity): Alert[] {
    return this.getAlerts().filter(alert => alert.severity === severity);
  }

  /**
   * Get alerts by type
   */
  getAlertsByType(type: AlertType): Alert[] {
    return this.getAlerts().filter(alert => alert.type === type);
  }

  /**
   * Get alert rules
   */
  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get rule by ID
   */
  getRule(ruleId: string): AlertRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Generate alert ID
   */
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear resolved alerts older than specified days
   */
  clearOldAlerts(daysOld: number): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    let clearedCount = 0;
    for (const [alertId, alert] of this.alerts.entries()) {
      if (alert.resolved && alert.resolvedAt && alert.resolvedAt < cutoffDate) {
        this.alerts.delete(alertId);
        clearedCount++;
      }
    }

    if (clearedCount > 0) {
      logger.info('Old alerts cleared', { count: clearedCount, cutoffDate });
    }

    return clearedCount;
  }
} 