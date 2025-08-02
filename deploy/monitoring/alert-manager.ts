import { EventEmitter } from 'events';
import { getLogger } from '../../src/logging';

const logger = getLogger().child({ _component: 'alert-manager' });

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

// Alert rule interface
export interface AlertRule {
  _id: string;
  _name: string;
  _type: AlertType;
  _severity: AlertSeverity;
  _condition: string;
  _threshold: number;
  _enabled: boolean;
  _cooldown: number; // seconds
  lastTriggered?: Date;
}

// Alert manager
export class AlertManager extends EventEmitter {
  private _alerts: Map<string, Alert> = new Map();
  private _rules: Map<string, AlertRule> = new Map();
  private _cooldowns: Map<string, Date> = new Map();

  constructor() {
    super();
    this.initializeDefaultRules();
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultRules(): void {
    const _defaultRules: AlertRule[] = [
      {
        id: 'high_error_rate',
        _name: 'High Error Rate',
        _type: AlertType.HIGH_ERROR_RATE,
        _severity: AlertSeverity.HIGH,
        _condition: 'error_rate > threshold',
        _threshold: 5, // 5% error rate
        _enabled: true,
        _cooldown: 300 // 5 minutes
      },
      {
        _id: 'high_latency',
        _name: 'High Latency',
        _type: AlertType.HIGH_LATENCY,
        _severity: AlertSeverity.MEDIUM,
        _condition: 'response_time > threshold',
        _threshold: 2000, // 2 seconds
        _enabled: true,
        _cooldown: 180 // 3 minutes
      },
      {
        _id: 'disk_space_low',
        _name: 'Low Disk Space',
        _type: AlertType.DISK_SPACE_LOW,
        _severity: AlertSeverity.HIGH,
        _condition: 'disk_usage > threshold',
        _threshold: 85, // 85% usage
        _enabled: true,
        _cooldown: 600 // 10 minutes
      },
      {
        _id: 'memory_low',
        _name: 'Low Memory',
        _type: AlertType.MEMORY_LOW,
        _severity: AlertSeverity.HIGH,
        _condition: 'memory_usage > threshold',
        _threshold: 90, // 90% usage
        _enabled: true,
        _cooldown: 300 // 5 minutes
      }
    ];

    for (const rule of defaultRules) {
      this.rules.set(rule.id, rule);
    }

    logger.info('Default alert rules initialized');
  }

  /**
   * Add alert rule
   */
  addRule(_rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    logger.info('Alert rule added', { _ruleId: rule.id, _ruleName: rule.name });
  }

  /**
   * Remove alert rule
   */
  removeRule(_ruleId: string): boolean {
    const removed = this.rules.delete(ruleId);
    if (removed) {
      logger.info('Alert rule removed', { ruleId });
    }
    return removed;
  }

  /**
   * Enable/disable alert rule
   */
  setRuleEnabled(_ruleId: string, _enabled: boolean): boolean {
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
  evaluateRules(_metrics: Record<string, number>): void {
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
  private evaluateCondition(_rule: AlertRule, _metrics: Record<string, number>): boolean {
    const key = rule.condition.split('>')[0]?.trim();
    if (!key) return false;

    const value = metrics[key];
    if (value === undefined) {
      return false;
    }

    return value > rule.threshold;
  }

  /**
   * Trigger alert
   */
  private triggerAlert(_rule: AlertRule, _metrics: Record<string, number>): void {
    const _alert: Alert = {
      _id: this.generateAlertId(),
      _type: rule.type,
      _severity: rule.severity,
      _title: `${rule.name} Alert`,
      _message: `Condition "${rule.condition}" exceeded threshold ${rule.threshold}`,
      _timestamp: new Date(),
      _metadata: {
        _ruleId: rule.id,
        _ruleName: rule.name,
        _condition: rule.condition,
        _threshold: rule.threshold,
        _currentValue: metrics[rule.condition.split('>')[0]?.trim() || ''],
        metrics
      },
      _resolved: false,
      _acknowledged: false
    };

    this.alerts.set(alert.id, alert);
    rule.lastTriggered = new Date();

    logger.warn('Alert triggered', { _alertId: alert.id, _ruleId: rule.id });
    this.emit('alert', alert);
  }

  /**
   * Create manual alert
   */
  createAlert(_alertData: Omit<Alert, 'id' | 'timestamp' | 'resolved' | 'acknowledged'>): string {
    const _alert: Alert = {
      ...alertData,
      _id: this.generateAlertId(),
      _timestamp: new Date(),
      _resolved: false,
      _acknowledged: false
    };

    this.alerts.set(alert.id, alert);
    logger.info('Manual alert created', { _alertId: alert.id });
    this.emit('alert', alert);

    return alert.id;
  }

  /**
   * Resolve alert
   */
  resolveAlert(_alertId: string, resolvedBy?: string): boolean {
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
  getAlertsBySeverity(_severity: AlertSeverity): Alert[] {
    return this.getAlerts().filter(alert => alert.severity === severity);
  }

  /**
   * Get alerts by type
   */
  getAlertsByType(_type: AlertType): Alert[] {
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
  getRule(_ruleId: string): AlertRule | undefined {
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
  clearOldAlerts(_daysOld: number): number {
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
      logger.info('Old alerts cleared', { _count: clearedCount, cutoffDate });
    }

    return clearedCount;
  }
}
