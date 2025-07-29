// src/monitoring/alerts.ts
// Sentry integration disabled - using no-op implementations

export interface AlertConfig {
  name: string;
  threshold: number;
  window: number; // Time window in minutes
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
}

export interface AlertContext {
  timestamp: Date;
  value: number;
  threshold: number;
  severity: string;
  metadata?: Record<string, any>;
}

export class AlertManager {
  private alerts: Map<string, AlertConfig> = new Map();
  private alertHistory: Map<string, AlertContext[]> = new Map();
  private readonly maxHistorySize = 1000;

  constructor() {
    this.setupDefaultAlerts();
  }

  private setupDefaultAlerts(): void {
    // Default alert configurations
    const defaultAlerts: AlertConfig[] = [
      {
        name: 'high_error_rate',
        threshold: 0.05, // 5% error rate
        window: 5, // 5 minutes
        severity: 'high',
        enabled: true,
      },
      {
        name: 'response_time_spike',
        threshold: 2000, // 2 seconds
        window: 5,
        severity: 'medium',
        enabled: true,
      },
      {
        name: 'memory_usage_high',
        threshold: 0.85, // 85% memory usage
        window: 10,
        severity: 'high',
        enabled: true,
      },
      {
        name: 'database_connection_errors',
        threshold: 5, // 5 connection errors
        window: 5,
        severity: 'critical',
        enabled: true,
      },
    ];

    defaultAlerts.forEach(alert => {
      this.alerts.set(alert.name, alert);
      this.alertHistory.set(alert.name, []);
    });
  }

  public addAlert(config: AlertConfig): void {
    this.alerts.set(config.name, config);
    if (!this.alertHistory.has(config.name)) {
      this.alertHistory.set(config.name, []);
    }
  }

  public removeAlert(name: string): void {
    this.alerts.delete(name);
    this.alertHistory.delete(name);
  }

  public checkAlert(name: string, value: number, metadata?: Record<string, any>): boolean {
    const alert = this.alerts.get(name);
    if (!alert || !alert.enabled) {
      return false;
    }

    const context: AlertContext = {
      timestamp: new Date(),
      value,
      threshold: alert.threshold,
      severity: alert.severity,
      metadata,
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

  private evaluateAlert(alert: AlertConfig, value: number): boolean {
    // Simple threshold-based evaluation
    return value > alert.threshold;
  }

  private triggerAlert(name: string, context: AlertContext): void {
    console.warn(`🚨 ALERT TRIGGERED: ${name}`, {
      value: context.value,
      threshold: context.threshold,
      severity: context.severity,
      timestamp: context.timestamp,
      metadata: context.metadata,
    });

    // Sentry disabled - no-op
  }

  public getAlertHistory(name: string, limit?: number): AlertContext[] {
    const history = this.alertHistory.get(name) || [];
    if (limit) {
      return history.slice(-limit);
    }
    return [...history];
  }

  public getAllAlerts(): AlertConfig[] {
    return Array.from(this.alerts.values());
  }

  public getAlertStats(name: string, windowMinutes: number = 60): {
    count: number;
    avgValue: number;
    maxValue: number;
    minValue: number;
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
      count: recentAlerts.length,
      avgValue: values.reduce((sum, val) => sum + val, 0) / values.length,
      maxValue: Math.max(...values),
      minValue: Math.min(...values),
    };
  }
}

// Global alert manager instance
export const alertManager = new AlertManager();
