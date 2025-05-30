// src/monitoring/alerts.ts
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { getLogger } from '../logging';
import { 
  httpRequestsErrorCounter, 
  dbQueryDurationMicroseconds, 
  memoryUsagePercentGauge,
  healthCheckStatusGauge
} from './metrics';

// Get logger for monitoring
const logger = getLogger().child({ component: 'monitoring' });

// Alert thresholds
export const ALERT_THRESHOLDS = {
  // Error rate thresholds (errors per minute)
  ERROR_RATE_WARNING: 5,
  ERROR_RATE_CRITICAL: 20,
  
  // Response time thresholds (milliseconds)
  RESPONSE_TIME_WARNING: 1000,
  RESPONSE_TIME_CRITICAL: 3000,
  
  // CPU usage thresholds (percent)
  CPU_USAGE_WARNING: 70,
  CPU_USAGE_CRITICAL: 90,
  
  // Memory usage thresholds (percent) 
  MEMORY_USAGE_WARNING: 75,
  MEMORY_USAGE_CRITICAL: 85, // Updated to 85% per requirement
  
  // Database connection thresholds (percent of pool)
  DB_CONNECTIONS_WARNING: 70,
  DB_CONNECTIONS_CRITICAL: 90,
  
  // Database response time thresholds (milliseconds)
  DB_RESPONSE_TIME_WARNING: 250, 
  DB_RESPONSE_TIME_CRITICAL: 500, // Set to 500ms per requirement
  
  // Queue depth thresholds (jobs in queue)
  QUEUE_DEPTH_WARNING: 100,
  QUEUE_DEPTH_CRITICAL: 500,
  
  // Health check failure thresholds (consecutive failures)
  HEALTH_CHECK_WARNING: 1,
  HEALTH_CHECK_CRITICAL: 3,
  
  // HTTP 5xx rate thresholds (errors per minute)
  HTTP_5XX_WARNING: 3,
  HTTP_5XX_CRITICAL: 10
};

// Allow override from environment variables
export function getAlertThresholds() {
  const thresholds = { ...ALERT_THRESHOLDS };
  
  // Override from environment variables if set
  Object.keys(thresholds).forEach(key => {
    const envKey = `ALERT_${key}`;
    if (process.env[envKey] && !isNaN(Number(process.env[envKey]))) {
      thresholds[key] = Number(process.env[envKey]);
    }
  });
  
  return thresholds;
}

/**
 * Initialize Sentry monitoring and alerts
 */
export function initializeMonitoring(): void {
  const dsn = process.env.SENTRY_DSN;
  
  if (!dsn) {
    logger.warn('Sentry DSN not configured, monitoring and alerts disabled');
    return;
  }
  
  try {
    // Initialize Sentry
    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
      profilesSampleRate: 0.1,
      integrations: [
        nodeProfilingIntegration(),
        Sentry.httpIntegration(),
        Sentry.expressIntegration(), // Will be initialized with app later
      ],
      beforeSend(event) {
        // Don't send events in development mode
        if (process.env.NODE_ENV === 'development' && !process.env.FORCE_SENTRY) {
          return null;
        }
        
        // Sanitize sensitive data if needed
        if (event.request && event.request.headers) {
          delete event.request.headers.cookie;
          delete event.request.headers.authorization;
        }
        
        // Check for personally identifiable information and remove it
        if (event.user && event.user.email) {
          event.user.email = 'REDACTED';
        }
        
        return event;
      }
    });
    
    logger.info('Sentry monitoring initialized successfully');
  } catch (error: unknown) {
    logger.error('Failed to initialize Sentry', error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Set up alerts for the application
 * @param app Express application
 * @param dbPool Database connection pool
 */
export function setupAlerts(app: unknown, dbPool: unknown): void {
  if (!process.env.SENTRY_DSN) {
    return;
  }
  
  try {
    // Initialize Sentry with Express - using non-TypeScript approach to avoid import errors
    const requestHandler = (Sentry as any).Handlers?.requestHandler();
    const tracingHandler = (Sentry as any).Handlers?.tracingHandler();
    
    if (requestHandler && tracingHandler) {
      app.use(requestHandler);
      app.use(tracingHandler);
      logger.info('Sentry request and tracing handlers initialized');
    } else {
      logger.warn('Sentry handlers not available, monitoring integration will be limited');
    }
    
    // Set up a periodic health check for alerting
    setInterval(() => {
      checkSystemHealth(dbPool);
    }, 60000); // Check every minute
    
    logger.info('Monitoring alerts configured successfully');
  } catch (error: unknown) {
    logger.error('Failed to set up alerts', error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Check system health and trigger alerts if needed
 */
async function checkSystemHealth(dbPool: unknown): Promise<void> {
  try {
    // Check memory usage
    const memoryUsage = process.memoryUsage();
    const memoryUsagePercent = Math.round(memoryUsage.heapUsed / memoryUsage.heapTotal * 100);
    
    if (memoryUsagePercent >= ALERT_THRESHOLDS.MEMORY_USAGE_CRITICAL) {
      triggerAlert('memory_critical', `Memory usage critical: ${memoryUsagePercent}%`, 'critical');
    } else if (memoryUsagePercent >= ALERT_THRESHOLDS.MEMORY_USAGE_WARNING) {
      triggerAlert('memory_warning', `Memory usage warning: ${memoryUsagePercent}%`, 'warning');
    }
    
    // Check CPU usage
    const os = require('os');
    const cpuUsage = os.loadavg()[0] / os.cpus().length * 100;
    
    if (cpuUsage >= ALERT_THRESHOLDS.CPU_USAGE_CRITICAL) {
      triggerAlert('cpu_critical', `CPU usage critical: ${cpuUsage.toFixed(1)}%`, 'critical');
    } else if (cpuUsage >= ALERT_THRESHOLDS.CPU_USAGE_WARNING) {
      triggerAlert('cpu_warning', `CPU usage warning: ${cpuUsage.toFixed(1)}%`, 'warning');
    }
    
    // Check database connections
    if (dbPool) {
      const idleCount = dbPool.idleCount;
      const totalCount = dbPool.totalCount;
      const usedPercent = Math.round((totalCount - idleCount) / totalCount * 100);
      
      if (usedPercent >= ALERT_THRESHOLDS.DB_CONNECTIONS_CRITICAL) {
        triggerAlert('db_connections_critical', `Database connections critical: ${usedPercent}%`, 'critical');
      } else if (usedPercent >= ALERT_THRESHOLDS.DB_CONNECTIONS_WARNING) {
        triggerAlert('db_connections_warning', `Database connections warning: ${usedPercent}%`, 'warning');
      }
    }
    
    // Check queue depths (if we have access to the queue)
    try {
      const { getQueue, QueueType } = require('../queue');
      
      for (const queueType of Object.values(QueueType)) {
        const queue = getQueue(queueType);
        const waitingCount = await queue.getWaitingCount();
        
        if (waitingCount >= ALERT_THRESHOLDS.QUEUE_DEPTH_CRITICAL) {
          triggerAlert(
            `queue_depth_critical_${queueType}`,
            `Queue depth critical for ${queueType}: ${waitingCount} jobs waiting`,
            'critical'
          );
        } else if (waitingCount >= ALERT_THRESHOLDS.QUEUE_DEPTH_WARNING) {
          triggerAlert(
            `queue_depth_warning_${queueType}`,
            `Queue depth warning for ${queueType}: ${waitingCount} jobs waiting`,
            'warning'
          );
        }
      }
    } catch (error: unknown) {
      // Queue might not be available, ignore
    }
  } catch (error: unknown) {
    logger.error('Error checking system health', error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Trigger an alert based on a condition
 * @param key Alert identifier
 * @param message Alert message
 * @param level Alert level (info, warning, error, critical)
 */
export function triggerAlert(key: string, message: string, level: 'info' | 'warning' | 'error' | 'critical'): void {
  try {
    // Log the alert
    switch (level) {
      case 'info':
        logger.info(`ALERT: ${message}`, { alertKey: key, alertLevel: level });
        break;
      case 'warning':
        logger.warn(`ALERT: ${message}`, { alertKey: key, alertLevel: level });
        break;
      case 'error':
      case 'critical':
        logger.error(`ALERT: ${message}`, { alertKey: key, alertLevel: level });
        break;
    }
    
    // Send to Sentry if it's an error or critical
    if (level === 'error' || level === 'critical') {
      // Use modern Sentry API without relying on Severity enum
      Sentry.captureMessage(message, {
        level: level === 'critical' ? 'fatal' : 'error'
      });
    }
    
    // Send to other alert channels if configured (e.g. Slack, email, etc.)
    sendAlertToChannels(key, message, level);
  } catch (error: unknown) {
    logger.error('Failed to trigger alert', error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Send alert to configured channels
 */
function sendAlertToChannels(key: string, message: string, level: string): void {
  // Skip if no channels are configured
  if (!process.env.ALERT_CHANNELS) {
    return;
  }
  
  const channels = process.env.ALERT_CHANNELS.split(',');
  
  for (const channel of channels) {
    switch (channel.trim().toLowerCase()) {
      case 'slack':
        sendSlackAlert(message, level);
        break;
      case 'email':
        sendEmailAlert(message, level);
        break;
      // Add other channels as needed
    }
  }
}

/**
 * Send alert to Slack
 */
function sendSlackAlert(message: string, level: string): void {
  // Implement Slack webhook integration if configured
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  
  if (!webhookUrl) {
    return;
  }
  
  // Don't actually send in development unless forced
  if (process.env.NODE_ENV === 'development' && !process.env.FORCE_ALERTS) {
    logger.debug(`[DEV] Would send Slack alert: ${message}`);
    return;
  }
  
  try {
    // Simple implementation using fetch
    fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `[${level.toUpperCase()}] ${message}`,
        username: 'ChainSync Monitoring',
        icon_emoji: level === 'critical' ? ':rotating_light:' : 
                   level === 'error' ? ':x:' : 
                   level === 'warning' ? ':warning:' : ':information_source:'
      })
    }).catch(err => {
      logger.error('Failed to send Slack alert', err);
    });
  } catch (error: unknown) {
    logger.error('Error sending Slack alert', error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Send alert via email
 */
function sendEmailAlert(message: string, level: string): void {
  // Implement email integration if configured
  const alertEmail = process.env.ALERT_EMAIL;
  
  if (!alertEmail) {
    return;
  }
  
  // Don't actually send in development unless forced
  if (process.env.NODE_ENV === 'development' && !process.env.FORCE_ALERTS) {
    logger.debug(`[DEV] Would send email alert to ${alertEmail}: ${message}`);
    return;
  }
  
  try {
    // Simple implementation using nodemailer or similar service would go here
    // This is just a placeholder
    logger.info(`Sending email alert to ${alertEmail}: ${message}`);
  } catch (error: unknown) {
    logger.error('Error sending email alert', error instanceof Error ? error : new Error(String(error)));
  }
}
