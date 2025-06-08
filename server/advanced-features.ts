import { Express } from 'express';

import { applyAdvancedSecurity } from './middleware/advanced-security';
import { applyRateLimiters, shutdownRateLimiter } from './middleware/rate-limiter';
import { alertManager, AlertSeverity } from './monitoring/alert-manager';
import { metricsCollector } from './monitoring/metrics-collector';
import sessionManager from './services/auth/session-manager';
import { appHealthManager } from './utils/app-health';
import { getLogger } from '../src/logging/index';

const logger = getLogger().child({ component: 'advanced-features' });

/**
 * Apply all advanced features to the application
 * This includes:
 * - Advanced security headers and protections
 * - Tiered rate limiting
 * - Session management
 * - Monitoring and metrics collection
 * - Health checks and alerts
 */
export function applyAdvancedFeatures(app: Express): void {
  // Apply advanced security features
  applyAdvancedSecurity(app);
  logger.info('Advanced security features applied');

  // Apply tiered rate limiting
  applyRateLimiters(app);
  logger.info('Tiered rate limiting applied');

  // Apply session management
  app.use(sessionManager.middleware() as any); // Cast to any to bypass type error
  logger.info('Session management middleware applied');

  // Start metrics collection
  metricsCollector.startCollection(30000); // Collect every 30 seconds
  logger.info('Metrics collection started');

  // Start health checks
  appHealthManager.startHealthChecks(60000); // Check every 60 seconds
  logger.info('Health checks started');

  // Register alerts for critical system events
  registerSystemAlerts();
  logger.info('System alerts registered');

  // Register shutdown handler
  registerGracefulShutdown();
  logger.info('Graceful shutdown handler registered');

  logger.info('All advanced features applied successfully');
}

/**
 * Register system-level alerts
 */
function registerSystemAlerts(): void {
  // Add alert for low disk space
  alertManager.addRule(
    'low-disk-space',
    () => {
      const metrics = metricsCollector.getMetrics();
      return (metrics?.disk?.usagePercent ?? 0) > 90;
    },
    {
      title: 'Low disk space',
      message: 'Disk space usage is above 90%, action required',
      severity: AlertSeverity.ERROR,
      source: 'system-monitor',
      tags: { component: 'disk', type: 'resource' },
    }
  );

  // Add alert for high memory usage
  alertManager.addRule(
    'high-memory-usage',
    () => {
      const metrics = metricsCollector.getMetrics();
      return (metrics?.memory?.usagePercent ?? 0) > 85;
    },
    {
      title: 'High memory usage',
      message: 'Memory usage is above 85%, potential memory leak',
      severity: AlertSeverity.WARNING,
      source: 'system-monitor',
      tags: { component: 'memory', type: 'resource' },
    }
  );

  // Add alert for high CPU usage
  alertManager.addRule(
    'high-cpu-usage',
    () => {
      const metrics = metricsCollector.getMetrics();
      return (metrics?.cpu?.usage ?? 0) > 80;
    },
    {
      title: 'High CPU usage',
      message: 'CPU usage is above 80%, system may become unresponsive',
      severity: AlertSeverity.WARNING,
      source: 'system-monitor',
      tags: { component: 'cpu', type: 'resource' },
    }
  );

  // Add alert for database connection issues
  alertManager.addRule(
    'database-connection-issues',
    () => {
      const health = appHealthManager.getHealthHistory();
      if (health.length === 0) return false;

      const latest = health[health.length - 1];
      const dbComponent = latest.components.find(c => c.name === 'database');
      return dbComponent?.status === 'unhealthy';
    },
    {
      title: 'Database connection issues',
      message: 'Database health check failed, service may be degraded',
      severity: AlertSeverity.ERROR,
      source: 'health-monitor',
      tags: { component: 'database', type: 'connectivity' },
    }
  );

  logger.info('System alerts registered');
}

/**
 * Register graceful shutdown handlers
 */
function registerGracefulShutdown(): void {
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    // Send alert
    alertManager.alert({
      title: 'System shutdown initiated',
      message: `Graceful shutdown initiated by ${signal}`,
      severity: AlertSeverity.INFO,
      source: 'system',
      tags: { signal, type: 'lifecycle' },
    });

    // Stop health checks
    appHealthManager.shutdown();
    logger.info('Health checks stopped');

    // Stop metrics collection
    metricsCollector.shutdown();
    logger.info('Metrics collection stopped');

    // Shutdown rate limiter
    await shutdownRateLimiter();
    logger.info('Rate limiter shut down');

    // Shutdown session manager
    await sessionManager.shutdown();
    logger.info('Session manager shut down');

    // Shutdown alert manager
    alertManager.shutdown();
    logger.info('Alert manager shut down');

    // Exit process
    setTimeout(() => {
      logger.info('Exiting process');
      process.exit(0);
    }, 1000);
  };

  // Register signal handlers
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGHUP', () => shutdown('SIGHUP'));

  logger.info('Graceful shutdown handlers registered');
}

export default applyAdvancedFeatures;
