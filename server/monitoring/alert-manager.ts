import { getLogger } from '../../src/logging';
import axios from 'axios';
import { EventEmitter } from 'events';

const logger = getLogger().child({ component: 'alert-manager' });

/**
 * Alert severity levels
 */
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

/**
 * Alert notification channels
 */
export enum AlertChannel {
  EMAIL = 'email',
  SLACK = 'slack',
  WEBHOOK = 'webhook',
  SMS = 'sms',
  LOG = 'log'
}

/**
 * Alert payload interface
 */
export interface Alert {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  timestamp: number;
  source: string;
  tags: Record<string, string>;
  data?: Record<string, any>;
  acknowledged?: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: number;
}

/**
 * Alert notification configuration
 */
export interface AlertNotificationConfig {
  channels: AlertChannel[];
  minSeverity: AlertSeverity;
  webhookUrl?: string;
  emailConfig?: {
    recipients: string[];
    subject?: string;
  };
  slackConfig?: {
    channel: string;
    webhookUrl: string;
  };
  smsConfig?: {
    phoneNumbers: string[];
  };
}

/**
 * Default alert configuration
 */
const DEFAULT_ALERT_CONFIG: AlertNotificationConfig = {
  channels: [AlertChannel.LOG],
  minSeverity: AlertSeverity.WARNING
};

/**
 * Severity levels mapped to numeric values for comparison
 */
const SEVERITY_LEVELS = {
  [AlertSeverity.INFO]: 0,
  [AlertSeverity.WARNING]: 1,
  [AlertSeverity.ERROR]: 2,
  [AlertSeverity.CRITICAL]: 3
};

/**
 * Alert manager for monitoring and notifications
 */
export class AlertManager extends EventEmitter {
  private static instance: AlertManager;
  private config: AlertNotificationConfig;
  private alertHistory: Alert[] = [];
  private alertRules: Map<string, { condition: () => boolean, alert: Omit<Alert, 'id' | 'timestamp'> }> = new Map();
  private evaluationInterval: NodeJS.Timeout | null = null;

  /**
   * Get the singleton instance
   */
  public static getInstance(): AlertManager {
    if (!AlertManager.instance) {
      AlertManager.instance = new AlertManager();
    }
    return AlertManager.instance;
  }

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    super();
    this.config = DEFAULT_ALERT_CONFIG;
    
    // Load configuration from environment variables
    this.loadConfigFromEnv();
    
    // Listen for alert events
    this.on('alert', this.processAlert.bind(this));

    // Start rule evaluation
    this.startRuleEvaluation();
  }

  /**
   * Load configuration from environment variables
   */
  private loadConfigFromEnv(): void {
    const channels: AlertChannel[] = [];
    
    if (process.env.ALERT_CHANNEL_LOG === 'true') {
      channels.push(AlertChannel.LOG);
    }
    
    if (process.env.ALERT_CHANNEL_WEBHOOK === 'true' && process.env.ALERT_WEBHOOK_URL) {
      channels.push(AlertChannel.WEBHOOK);
    }
    
    if (process.env.ALERT_CHANNEL_SLACK === 'true' && process.env.ALERT_SLACK_WEBHOOK_URL) {
      channels.push(AlertChannel.SLACK);
    }
    
    if (process.env.ALERT_CHANNEL_EMAIL === 'true' && process.env.ALERT_EMAIL_RECIPIENTS) {
      channels.push(AlertChannel.EMAIL);
    }
    
    if (process.env.ALERT_CHANNEL_SMS === 'true' && process.env.ALERT_SMS_NUMBERS) {
      channels.push(AlertChannel.SMS);
    }
    
    // Only update if we have channels configured
    if (channels.length > 0) {
      this.config = {
        channels,
        minSeverity: (process.env.ALERT_MIN_SEVERITY as AlertSeverity) || AlertSeverity.WARNING,
        webhookUrl: process.env.ALERT_WEBHOOK_URL,
        slackConfig: process.env.ALERT_SLACK_WEBHOOK_URL ? {
          channel: process.env.ALERT_SLACK_CHANNEL || '#alerts',
          webhookUrl: process.env.ALERT_SLACK_WEBHOOK_URL
        } : undefined,
        emailConfig: process.env.ALERT_EMAIL_RECIPIENTS ? {
          recipients: process.env.ALERT_EMAIL_RECIPIENTS.split(','),
          subject: process.env.ALERT_EMAIL_SUBJECT || 'ChainSync Alert'
        } : undefined,
        smsConfig: process.env.ALERT_SMS_NUMBERS ? {
          phoneNumbers: process.env.ALERT_SMS_NUMBERS.split(',')
        } : undefined
      };
    }
  }

  /**
   * Configure the alert manager
   */
  configure(config: Partial<AlertNotificationConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Alert manager configured', { channels: this.config.channels });
  }

  /**
   * Send an alert
   */
  alert(alertData: Omit<Alert, 'id' | 'timestamp'>): void {
    const alert: Alert = {
      ...alertData,
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    };
    
    this.emit('alert', alert);
  }

  /**
   * Process an alert through configured channels
   */
  private async processAlert(alert: Alert): Promise<void> {
    // Check if alert meets minimum severity level
    if (SEVERITY_LEVELS[alert.severity] < SEVERITY_LEVELS[this.config.minSeverity]) {
      return;
    }
    
    // Add to history
    this.alertHistory.push(alert);
    if (this.alertHistory.length > 100) {
      this.alertHistory.shift(); // Keep history size limited
    }
    
    // Process through each configured channel
    await Promise.all(this.config.channels.map(channel => this.sendAlertToChannel(channel, alert)));
  }

  /**
   * Send alert to a specific channel
   */
  private async sendAlertToChannel(channel: AlertChannel, alert: Alert): Promise<void> {
    try {
      switch (channel) {
        case AlertChannel.LOG:
          this.sendToLog(alert);
          break;
        case AlertChannel.WEBHOOK:
          await this.sendToWebhook(alert);
          break;
        case AlertChannel.SLACK:
          await this.sendToSlack(alert);
          break;
        case AlertChannel.EMAIL:
          await this.sendToEmail(alert);
          break;
        case AlertChannel.SMS:
          await this.sendToSms(alert);
          break;
      }
    } catch (error) {
      logger.error('Failed to send alert to channel', { 
        channel, 
        alertId: alert.id, 
        error: (error as Error).message 
      });
    }
  }

  /**
   * Send alert to logs
   */
  private sendToLog(alert: Alert): void {
    const logMethod = {
      [AlertSeverity.INFO]: logger.info.bind(logger),
      [AlertSeverity.WARNING]: logger.warn.bind(logger),
      [AlertSeverity.ERROR]: logger.error.bind(logger),
      [AlertSeverity.CRITICAL]: logger.error.bind(logger)
    }[alert.severity];
    
    logMethod(`ALERT: ${alert.title}`, {
      alertId: alert.id,
      message: alert.message,
      severity: alert.severity,
      source: alert.source,
      tags: alert.tags
    });
  }

  /**
   * Send alert to webhook
   */
  private async sendToWebhook(alert: Alert): Promise<void> {
    if (!this.config.webhookUrl) {
      logger.warn('No webhook URL configured for alerts');
      return;
    }
    
    await axios.post(this.config.webhookUrl, alert);
  }

  /**
   * Send alert to Slack
   */
  private async sendToSlack(alert: Alert): Promise<void> {
    if (!this.config.slackConfig?.webhookUrl) {
      logger.warn('No Slack webhook URL configured for alerts');
      return;
    }
    
    const color = {
      [AlertSeverity.INFO]: '#36a64f',
      [AlertSeverity.WARNING]: '#ffcc00',
      [AlertSeverity.ERROR]: '#ff9900',
      [AlertSeverity.CRITICAL]: '#ff0000'
    }[alert.severity];
    
    const payload = {
      channel: this.config.slackConfig.channel,
      attachments: [{
        fallback: `${alert.severity.toUpperCase()}: ${alert.title}`,
        color,
        title: `[${alert.severity.toUpperCase()}] ${alert.title}`,
        text: alert.message,
        fields: [
          { title: 'Source', value: alert.source, short: true },
          { title: 'Severity', value: alert.severity, short: true },
          ...Object.entries(alert.tags).map(([key, value]) => ({
            title: key,
            value: value,
            short: true
          }))
        ],
        ts: Math.floor(alert.timestamp / 1000)
      }]
    };
    
    await axios.post(this.config.slackConfig.webhookUrl, payload);
  }

  /**
   * Send alert to email
   */
  private async sendToEmail(alert: Alert): Promise<void> {
    if (!this.config.emailConfig?.recipients.length) {
      logger.warn('No email recipients configured for alerts');
      return;
    }
    
    // This is a placeholder for email sending logic
    // In a real implementation, you would use a library like nodemailer
    logger.info('Would send email alert', {
      to: this.config.emailConfig.recipients,
      subject: `${this.config.emailConfig.subject}: ${alert.severity.toUpperCase()} - ${alert.title}`,
      body: `
        Alert: ${alert.title}
        Severity: ${alert.severity}
        Source: ${alert.source}
        Time: ${new Date(alert.timestamp).toISOString()}
        
        Message:
        ${alert.message}
        
        Tags:
        ${Object.entries(alert.tags).map(([key, value]) => `${key}: ${value}`).join('\n')}
      `
    });
  }

  /**
   * Send alert to SMS
   */
  private async sendToSms(alert: Alert): Promise<void> {
    if (!this.config.smsConfig?.phoneNumbers.length) {
      logger.warn('No SMS numbers configured for alerts');
      return;
    }
    
    // This is a placeholder for SMS sending logic
    // In a real implementation, you would use a service like Twilio
    logger.info('Would send SMS alert', {
      to: this.config.smsConfig.phoneNumbers,
      message: `${alert.severity.toUpperCase()}: ${alert.title} - ${alert.message}`
    });
  }

  /**
   * Add an alert rule
   */
  addRule(name: string, condition: () => boolean, alertTemplate: Omit<Alert, 'id' | 'timestamp'>): void {
    this.alertRules.set(name, { condition, alert: alertTemplate });
  }

  /**
   * Remove an alert rule
   */
  removeRule(name: string): boolean {
    return this.alertRules.delete(name);
  }

  /**
   * Start rule evaluation at regular intervals
   */
  private startRuleEvaluation(intervalMs: number = 60000): void {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
    }
    
    this.evaluationInterval = setInterval(() => {
      this.evaluateRules();
    }, intervalMs);
  }

  /**
   * Evaluate all alert rules
   */
  private evaluateRules(): void {
    for (const [name, rule] of this.alertRules.entries()) {
      try {
        if (rule.condition()) {
          this.alert(rule.alert);
        }
      } catch (error) {
        logger.error('Error evaluating alert rule', { 
          ruleName: name, 
          error: (error as Error).message 
        });
      }
    }
  }

  /**
   * Get alert history
   */
  getAlertHistory(): Alert[] {
    return [...this.alertHistory];
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.alertHistory.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedBy = acknowledgedBy;
      alert.acknowledgedAt = Date.now();
      return true;
    }
    return false;
  }

  /**
   * Shutdown the alert manager
   */
  shutdown(): void {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
      this.evaluationInterval = null;
    }
  }
}

// Export singleton instance
export const alertManager = AlertManager.getInstance();
export default alertManager;
