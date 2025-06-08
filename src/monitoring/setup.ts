// src/monitoring/setup.ts
import os from 'os';

import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { Express, Request, Response, NextFunction, ErrorRequestHandler } from 'express';

import { getLogger } from '../logging';
import { initTracing, traceContextMiddleware } from './tracing';

// Get logger for monitoring setup
const logger = getLogger().child({ component: 'monitoring-setup' });

/**
 * Initialize Sentry monitoring
 */
export function initializeMonitoring() {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    logger.warn('Sentry DSN not configured, monitoring disabled');
    return;
  }

  try {
    // Initialize Sentry
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
      profilesSampleRate: 0.1,
      integrations: [
        nodeProfilingIntegration(), // Corrected usage
      ],
      beforeSend(event) {
        // Don't send events in development mode
        if (process.env.NODE_ENV === 'development' && !process.env.FORCE_SENTRY) {
          return null;
        }

        // Sanitize sensitive data
        if (event.request && event.request.headers) {
          delete event.request.headers.cookie;
          delete event.request.headers.authorization;
        }

        return event;
      },
    });

    logger.info('Sentry monitoring initialized successfully');
  } catch (error: unknown) {
    logger.error('Failed to initialize Sentry', { error });
  }
}

// Removed configureSentryRequestHandler and configureSentryErrorHandler from this file
// as Sentry.Handlers seems unavailable and this duplicates setup from sentryIntegration.ts.
// Sentry Express middleware setup should be centralized.

/**
 * Set user context in Sentry
 * Call this when a user logs in or out
 */
export function setSentryUser(user: { id: string | number } | null) {
  if (!process.env.SENTRY_DSN) {
    return;
  }

  if (user) {
    Sentry.setUser({ id: String(user.id) });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Set extra context for Sentry
 * Useful for adding application-specific data to error reports
 */
export function setSentryContext(name: string, context: Record<string, any>) {
  if (!process.env.SENTRY_DSN) {
    return;
  }

  Sentry.setContext(name, context);
}

/**
 * Set tag for Sentry
 * Tags are key-value pairs that are indexed and searchable
 */
export function setSentryTag(key: string, value: string) {
  if (!process.env.SENTRY_DSN) {
    return;
  }

  Sentry.setTag(key, value);
}

/**
 * Capture exception in Sentry
 * Use this to manually capture exceptions
 */
export function captureException(error: Error, context?: Record<string, any>) {
  if (!process.env.SENTRY_DSN) {
    logger.error('Error captured (Sentry disabled)', { error, ...context });
    return;
  }

  Sentry.withScope(scope => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    Sentry.captureException(error);
  });

  logger.error('Error captured and sent to Sentry', { error: error.message });
}

/**
 * Initialize OpenTelemetry distributed tracing
 */
export function initializeTracing(app: Express) {
  // Check if tracing is enabled
  if (process.env.OTEL_ENABLED !== 'true') {
    logger.info('OpenTelemetry tracing is disabled');
    return;
  }

  try {
    // Initialize OpenTelemetry
    initTracing();

    // Add trace context middleware to Express
    app.use(traceContextMiddleware as any); // Cast to any if it causes issues, to be reviewed with tracing.ts

    logger.info('OpenTelemetry distributed tracing initialized successfully', {
      serviceName: process.env.OTEL_SERVICE_NAME || 'chainsync-api',
      endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
    });
  } catch (error: unknown) {
    logger.error('Failed to initialize OpenTelemetry tracing', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Initialize health checks for the application
 */
export function initializeHealthChecks(
  app: Express,
  dbPool:
    | {
        connect: () => Promise<{
          query: (sql: string) => Promise<{ rowCount: number }>;
          release: () => void;
        }>;
      }
    | any
) {
  // Added a more specific placeholder for dbPool
  // Set up periodic health checks
  const interval = parseInt(process.env.HEALTH_CHECK_INTERVAL || '60000', 10);

  setInterval(async () => {
    let dbHealthy = false;
    try {
      // Check database connection
      if (dbPool && typeof dbPool.connect === 'function') {
        const dbClient = await dbPool.connect();
        const result = await dbClient.query('SELECT 1');
        dbClient.release();
        if (result.rowCount === 1) {
          dbHealthy = true;
        }
        logger.info('Health check: Database connection attempt completed', {
          successful: dbHealthy,
        });
      } else {
        logger.warn('Health check: dbPool does not have a connect method or is not provided.');
      }

      // Check memory usage
      const memoryUsage = process.memoryUsage();
      const memoryUsagePercent =
        memoryUsage.heapTotal > 0
          ? Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
          : 0;

      // Check CPU usage
      const cpus = os.cpus();
      const cpuUsage = cpus.length > 0 ? (os.loadavg()[0] / cpus.length) * 100 : 0;

      // Log health status
      logger.info('Health check completed', {
        database: dbHealthy ? 'healthy' : 'unhealthy',
        memory: {
          used: memoryUsage.heapUsed,
          total: memoryUsage.heapTotal,
          percent: memoryUsagePercent,
          status:
            memoryUsagePercent > 90 ? 'critical' : memoryUsagePercent > 75 ? 'warning' : 'healthy',
        },
        cpu: {
          usage: cpuUsage.toFixed(1),
          status: cpuUsage > 90 ? 'critical' : cpuUsage > 70 ? 'warning' : 'healthy',
        },
      });

      // Send alert if metrics exceed thresholds
      if (memoryUsagePercent > 90 || cpuUsage > 90) {
        captureException(new Error('Resource usage critical'), {
          memory: memoryUsagePercent,
          cpu: cpuUsage.toFixed(1),
        });
      }
    } catch (error: unknown) {
      logger.error('Health check failed', { error });
      captureException(error instanceof Error ? error : new Error('Health check failed'));
    }
  }, interval);

  logger.info('Health checks initialized', { interval });
}
