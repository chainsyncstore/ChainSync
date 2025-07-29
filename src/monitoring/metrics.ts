// src/monitoring/metrics.ts
// import * as Sentry from '@sentry/node';
import * as promClient from 'prom-client';
import { Request, Response, NextFunction } from 'express';
import { getLogger } from '../logging';

const logger = getLogger().child({ component: 'metrics' });

// Enable default metrics collection
promClient.collectDefaultMetrics({
  prefix: 'chainsync_',
  register: promClient.register,
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5], // buckets for GC duration in seconds
});

// Create custom metrics
// HTTP metrics
export const httpRequestDurationMicroseconds = new promClient.Histogram({
  name: 'chainsync_http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status_code'],
  // buckets for response time from 1ms to 10s
  buckets: [1, 5, 15, 50, 100, 200, 500, 1000, 2000, 5000, 10000]
});

export const httpRequestsTotalCounter = new promClient.Counter({
  name: 'chainsync_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

export const httpRequestsErrorCounter = new promClient.Counter({
  name: 'chainsync_http_errors_total',
  help: 'Total number of HTTP errors',
  labelNames: ['method', 'route', 'status_code', 'error_type']
});

// Database metrics
export const dbConnectionsGauge = new promClient.Gauge({
  name: 'chainsync_db_connections',
  help: 'Current number of database connections',
});

export const dbQueryDurationMicroseconds = new promClient.Histogram({
  name: 'chainsync_db_query_duration_ms',
  help: 'Duration of database queries in ms',
  labelNames: ['query_type'],
  buckets: [1, 5, 15, 50, 100, 200, 500, 1000, 2000, 5000]
});

export const dbErrorsCounter = new promClient.Counter({
  name: 'chainsync_db_errors_total',
  help: 'Total number of database errors',
  labelNames: ['query_type', 'error_type']
});

// Memory metrics
export const memoryUsageGauge = new promClient.Gauge({
  name: 'chainsync_memory_usage_bytes',
  help: 'Process memory usage in bytes',
  labelNames: ['type'], // e.g., 'heap', 'rss', etc.
});

export const memoryUsagePercentGauge = new promClient.Gauge({
  name: 'chainsync_memory_usage_percent',
  help: 'Process memory usage as percentage of available',
});

// Health check metrics
export const healthCheckStatusGauge = new promClient.Gauge({
  name: 'chainsync_health_check_status',
  help: 'Status of health checks (1=up, 0=down)',
  labelNames: ['check_type', 'component']
});

export const healthCheckDurationMicroseconds = new promClient.Histogram({
  name: 'chainsync_health_check_duration_ms',
  help: 'Duration of health checks in ms',
  labelNames: ['check_type', 'component'],
  buckets: [1, 5, 15, 50, 100, 200, 500, 1000]
});

// Queue metrics
export const queueSizeGauge = new promClient.Gauge({
  name: 'chainsync_queue_size',
  help: 'Current size of the queue',
  labelNames: ['queue_name', 'status'] // status could be 'waiting', 'active', 'delayed', 'failed'
});

export const queueProcessingTimeHistogram = new promClient.Histogram({
  name: 'chainsync_queue_processing_time_ms',
  help: 'Time taken to process a job in ms',
  labelNames: ['queue_name'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]
});

// Alert metrics
export const alertCounterGauge = new promClient.Gauge({
  name: 'chainsync_alert_status',
  help: 'Alert status (1=firing, 0=resolved)',
  labelNames: ['alert_name', 'severity']
});

// Alert thresholds
export const ALERT_THRESHOLDS = {
  HIGH_MEMORY_PERCENT: 85, // 85% memory usage
  SLOW_DB_RESPONSE_MS: 500, // 500ms
  HTTP_5XX_ERROR_THRESHOLD: 5, // 5 errors in the timeframe
  HEALTH_CHECK_FAILURE_COUNT: 3, // 3 consecutive failures
};

/**
 * Configure alert thresholds from environment variables
 */
export function configureAlertThresholds() {
  const thresholds = { ...ALERT_THRESHOLDS };
  
  // Override from environment variables if provided
  if (process.env.ALERT_HIGH_MEMORY_PERCENT) {
    thresholds.HIGH_MEMORY_PERCENT = parseInt(process.env.ALERT_HIGH_MEMORY_PERCENT, 10);
  }
  
  if (process.env.ALERT_SLOW_DB_RESPONSE_MS) {
    thresholds.SLOW_DB_RESPONSE_MS = parseInt(process.env.ALERT_SLOW_DB_RESPONSE_MS, 10);
  }
  
  if (process.env.ALERT_HTTP_5XX_ERROR_THRESHOLD) {
    thresholds.HTTP_5XX_ERROR_THRESHOLD = parseInt(process.env.ALERT_HTTP_5XX_ERROR_THRESHOLD, 10);
  }
  
  if (process.env.ALERT_HEALTH_CHECK_FAILURE_COUNT) {
    thresholds.HEALTH_CHECK_FAILURE_COUNT = parseInt(process.env.ALERT_HEALTH_CHECK_FAILURE_COUNT, 10);
  }
  
  return thresholds;
}

/**
 * Middleware to track HTTP request metrics
 */
export function httpMetricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  
  // Record original end method
  const originalEnd = res.end;
  
  // Override end method to capture metrics before response is sent
  res.end = function(...args: any[]) {
    const responseTime = Date.now() - start;
    const route = req.route ? req.route.path : req.path;
    const method = req.method;
    const statusCode = res.statusCode.toString();
    
    // Record request duration
    httpRequestDurationMicroseconds
      .labels(method, route, statusCode)
      .observe(responseTime);
    
    // Increment request counter
    httpRequestsTotalCounter
      .labels(method, route, statusCode)
      .inc();
    
    // Track errors (5xx)
    if (statusCode.startsWith('5')) {
      httpRequestsErrorCounter
        .labels(method, route, statusCode, 'server_error')
        .inc();
      
      // Check if we should fire an alert for 5xx error rate
      // This is just marking the alert as firing - actual notification happens elsewhere
      alertCounterGauge
        .labels('http_5xx_rate', 'warning')
        .set(1);
    }
    
    // Call original end method
    return originalEnd.apply(res, args as any);
  };
  
  next();
}

/**
 * Track memory usage and check for high memory alerts
 */
export function trackMemoryUsage() {
  const memUsage = process.memoryUsage();
  
  // Record various memory metrics
  memoryUsageGauge.labels('rss').set(memUsage.rss);
  memoryUsageGauge.labels('heapTotal').set(memUsage.heapTotal);
  memoryUsageGauge.labels('heapUsed').set(memUsage.heapUsed);
  memoryUsageGauge.labels('external').set(memUsage.external);
  
  // Calculate memory percentage
  const memoryPercent = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);
  memoryUsagePercentGauge.set(memoryPercent);
  
  // Check for high memory alert
  const thresholds = configureAlertThresholds();
  if (memoryPercent > thresholds.HIGH_MEMORY_PERCENT) {
    alertCounterGauge
      .labels('high_memory_usage', 'critical')
      .set(1);
    
    logger.warn(`High memory usage alert: ${memoryPercent}% (threshold: ${thresholds.HIGH_MEMORY_PERCENT}%)`, {
      memoryPercent,
      rss: memUsage.rss,
      heapTotal: memUsage.heapTotal,
      heapUsed: memUsage.heapUsed
    });
  } else {
    // Reset alert if memory usage is back to normal
    alertCounterGauge
      .labels('high_memory_usage', 'critical')
      .set(0);
  }
}

/**
 * Track database query metrics
 */
export function trackDbQuery(queryType: string, durationMs: number, error?: Error) {
  // Record query duration
  dbQueryDurationMicroseconds
    .labels(queryType)
    .observe(durationMs);
  
  // Check for slow query alert
  const thresholds = configureAlertThresholds();
  if (durationMs > thresholds.SLOW_DB_RESPONSE_MS) {
    alertCounterGauge
      .labels('slow_db_response', 'warning')
      .set(1);
    
    logger.warn(`Slow DB query alert: ${durationMs}ms (threshold: ${thresholds.SLOW_DB_RESPONSE_MS}ms)`, {
      queryType,
      durationMs
    });
  }
  
  // Record error if present
  if (error) {
    dbErrorsCounter
      .labels(queryType, error.name || 'unknown')
      .inc();
    
    logger.error(`Database error in ${queryType}`, {
      error: error.message,
      stack: error.stack
    });
  }
}

/**
 * Track health check metrics
 */
export function trackHealthCheck(checkType: string, component: string, isUp: boolean, durationMs: number) {
  // Record health status
  healthCheckStatusGauge
    .labels(checkType, component)
    .set(isUp ? 1 : 0);
  
  // Record health check duration
  healthCheckDurationMicroseconds
    .labels(checkType, component)
    .observe(durationMs);
  
  // Check for health check failures
  if (!isUp) {
    alertCounterGauge
      .labels(`${component}_health_check_failure`, 'critical')
      .set(1);
    
    logger.warn(`Health check failure: ${component} (${checkType})`, {
      component,
      checkType,
      durationMs
    });
  } else {
    // Reset alert if health check is back to normal
    alertCounterGauge
      .labels(`${component}_health_check_failure`, 'critical')
      .set(0);
  }
}

/**
 * Track queue metrics
 */
export function trackQueueMetrics(queueName: string, waiting: number, active: number, delayed: number, failed: number) {
  queueSizeGauge.labels(queueName, 'waiting').set(waiting);
  queueSizeGauge.labels(queueName, 'active').set(active);
  queueSizeGauge.labels(queueName, 'delayed').set(delayed);
  queueSizeGauge.labels(queueName, 'failed').set(failed);
  
  // Check for queue backlog alert
  if (waiting > 100 || failed > 10) {
    alertCounterGauge
      .labels(`${queueName}_queue_backlog`, 'warning')
      .set(1);
    
    logger.warn(`Queue backlog alert: ${queueName}`, {
      queueName,
      waiting,
      active,
      delayed,
      failed
    });
  } else {
    // Reset alert if queue is back to normal
    alertCounterGauge
      .labels(`${queueName}_queue_backlog`, 'warning')
      .set(0);
  }
}

/**
 * Get metrics in Prometheus format
 */
export async function getMetrics(): Promise<string> {
  return await promClient.register.metrics();
}

/**
 * Initialize metrics collection
 */
export function initMetrics() {
  // Set up periodic memory usage tracking
  setInterval(trackMemoryUsage, 15000); // Every 15 seconds
  
  logger.info('Metrics collection initialized');
}
