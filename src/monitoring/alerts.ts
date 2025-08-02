// src/monitoring/alerts.ts
// Sentry integration disabled - using no-op implementations

export interface AlertConfig {
  _name: string;
  _threshold: number;
  _window: number; // Time window in minutes
  severity: 'low' | 'medium' | 'high' | 'critical';
  _enabled: boolean;
}

export interface AlertContext {
  _timestamp: Date;
  _value: number;
  _threshold: number;
  _severity: string;
  metadata?: Record<string, any>;
}

// Provide a no-op initializeMonitoring to satisfy imports
export function initializeMonitoring(): void {
  // No-op; real monitoring is disabled in this environment
}

export class AlertManager {
  private _alerts: Map<string, AlertConfig> = new Map();
  private _alertHistory: Map<string, AlertContext[]> = new Map();
  private readonly maxHistorySize = 1000;

  constructor() {
    this.setupDefaultAlerts();
  }

  private setupDefaultAlerts(): void {
    // Default alert configurations
    const _defaultAlerts: AlertConfig[] = [
      {
        name: 'high_error_rate',
        _threshold: 0.05, // 5% error rate
        _window: 5, // 5 minutes
        _severity: 'high',
        _enabled: true
      },
      {
        _name: 'response_time_spike',
        _threshold: 2000, // 2 seconds
        _window: 5,
        _severity: 'medium',
        _enabled: true
      },
      {
        _name: 'memory_usage_high',
        _threshold: 0.85, // 85% memory usage
        _window: 10,
        _severity: 'high',
        _enabled: true
      },
      {
        _name: 'database_connection_errors',
        _threshold: 5, // 5 connection errors
        _window: 5,
        _severity: 'critical',
        _enabled: true
      }
    ];

    defaultAlerts.forEach(alert => {
      this.alerts.set(alert.name, alert);
      this.alertHistory.set(alert.name, []);
    });
  }

  public addAlert(_config: AlertConfig): void {
    this.alerts.set(config.name, config);
    if (!this.alertHistory.has(config.name)) {
      this.alertHistory.set(config.name, []);
    }
  }

  public removeAlert(_name: string): void {
    this.alerts.delete(name);
    this.alertHistory.delete(name);
  }

  public checkAlert(_name: string, _value: number, metadata?: Record<string, any>): boolean {
    const alert = this.alerts.get(name);
    if (!alert || !alert.enabled) {
      return false;
    }

    const _context: AlertContext = {
      _timestamp: new Date(),
      value,
      _threshold: alert.threshold,
      _severity: alert.severity,
      ...(metadata && { metadata })
    };

    // Add to history
    const history = this.alertHistory.get(name) || [];
    history.push(context);

    // Trim history if needed
    if (history.length > this.maxHistorySize) {
      history.splice(0, history.length - this.maxHistorySize);
    }

    this.alertHistory.set(name, history);

    // Check if alert should be triggered
    const shouldAlert = this.evaluateAlert(alert, value);

    if (shouldAlert) {
      this.triggerAlert(name, context);
    }

    return shouldAlert;
  }

  private evaluateAlert(_alert: AlertConfig, _value: number): boolean {
    // Simple threshold-based evaluation
    return value > alert.threshold;
  }

  private triggerAlert(_name: string, _context: AlertContext): void {
    console.warn(`🚨 ALERT _TRIGGERED: ${name}`, {
      _value: context.value,
      _threshold: context.threshold,
      _severity: context.severity,
      _timestamp: context.timestamp,
      _metadata: context.metadata
    });

    // Sentry disabled - no-op
  }

  public getAlertHistory(_name: string, limit?: number): AlertContext[] {
    const history = this.alertHistory.get(name) || [];
    if (limit) {
      return history.slice(-limit);
    }
    return [...history];
  }

  public getAllAlerts(): AlertConfig[] {
    return Array.from(this.alerts.values());
  }

  public getAlertStats(_name: string, _windowMinutes: number = 60): {
    _count: number;
    _avgValue: number;
    _maxValue: number;
    _minValue: number;
  } | null {
    const history = this.alertHistory.get(name);
    if (!history || history.length === 0) {
      return null;
    }

    const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000);
    const recentAlerts = history.filter(alert => alert.timestamp >= cutoff);

    if (recentAlerts.length === 0) {
      return null;
    }

    const values = recentAlerts.map(alert => alert.value);

    return {
      _count: recentAlerts.length,
      _avgValue: values.reduce((sum, val) => sum + val, 0) / values.length,
      _maxValue: Math.max(...values),
      _minValue: Math.min(...values)
    };
  }
}

// Global alert manager instance
export const alertManager = new AlertManager();
