'use strict';
const __importDefault = (this && this.__importDefault) || function(mod) {
  return (mod && mod.__esModule) ? mod : { 'default': mod };
};
Object.defineProperty(exports, '__esModule', { value: true });
exports.setDbPool = setDbPool;
// server/routes/health.ts
const express_1 = require('express');
const logging_1 = require('../../src/logging');
const redis_1 = require('../../src/cache/redis');
const queue_1 = require('../../src/queue');
const perf_hooks_1 = require('perf_hooks');
const os_1 = __importDefault(require('os'));
// Get logger for health routes
const logger = (0, logging_1.getLogger)().child({ component: 'health-routes' });
// Create router
const router = (0, express_1.Router)();
// Define database connection pool (using the existing one from the app)
let dbPool;
function setDbPool(pool) {
  dbPool = pool;
  logger.info('Database pool set for health checks');
}
/**
 * Basic health check
 * Returns 200 OK if the application is running
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString()
  });
});
/**
 * Kubernetes-style liveness probe
 * Indicates if the application is running
 */
router.get('/healthz', (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString()
  });
});
/**
 * Kubernetes-style readiness probe
 * Indicates if the application is ready to accept traffic
 */
router.get('/readyz', async(req, res) => {
  try {
    // Check if database is available
    const dbStatus = await checkDatabase();
    // Check if Redis is available (if configured)
    const redisStatus = await checkRedis();
    // Determine overall status
    const isReady = dbStatus.status === 'UP' &&
            (redisStatus.status === 'UP' || redisStatus.status === 'DISABLED');
    res.status(isReady ? 200 : 503).json({
      status: isReady ? 'UP' : 'DOWN',
      timestamp: new Date().toISOString(),
      components: {
        database: dbStatus,
        redis: redisStatus
      }
    });
  }
  catch (error) {
    logger.error('Readiness check failed', error instanceof Error ? error : new Error(String(error)));
    res.status(503).json({
      status: 'DOWN',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
/**
 * Detailed health check
 * Checks all system components and returns detailed status
 */
router.get('/health/details', async(req, res) => {
  const startTime = perf_hooks_1.performance.now();
  try {
    // Check database connection
    const dbStatus = await checkDatabase();
    // Check Redis connection
    const redisStatus = await checkRedis();
    // Check queue status
    const queueStatus = await checkQueues();
    // System info
    const systemInfo = {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuLoad: os_1.default.loadavg(),
      totalMemory: os_1.default.totalmem(),
      freeMemory: os_1.default.freemem()
    };
    // Overall status
    const overallStatus = dbStatus.status === 'UP' &&
            redisStatus.status === 'UP' ?
      'UP' : 'DEGRADED';
    // Calculate response time
    const responseTime = perf_hooks_1.performance.now() - startTime;
    res.status(overallStatus === 'UP' ? 200 : 207).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime.toFixed(2)}ms`,
      services: {
        database: dbStatus,
        redis: redisStatus,
        queues: queueStatus
      },
      system: systemInfo
    });
  }
  catch (error) {
    logger.error('Error in detailed health check', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      status: 'DOWN',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
/**
 * Database health check
 */
async function checkDatabase() {
  if (!dbPool) {
    return { status: 'UNKNOWN', error: 'Database pool not initialized' };
  }
  const startTime = perf_hooks_1.performance.now();
  try {
    // Simple query to check database connection
    const result = await dbPool.query('SELECT 1');
    const responseTime = perf_hooks_1.performance.now() - startTime;
    return {
      status: 'UP',
      responseTime: `${responseTime.toFixed(2)}ms`
    };
  }
  catch (error) {
    logger.error('Database health check failed', error instanceof Error ? error : new Error(String(error)));
    return {
      status: 'DOWN',
      error: error instanceof Error ? error.message : 'Unknown database error',
      responseTime: `${(perf_hooks_1.performance.now() - startTime).toFixed(2)}ms`
    };
  }
}
/**
 * Redis health check
 */
async function checkRedis() {
  const startTime = perf_hooks_1.performance.now();
  const redisClient = (0, redis_1.getRedisClient)();
  if (!redisClient) {
    return {
      status: process.env.REDIS_URL ? 'DOWN' : 'DISABLED',
      error: process.env.REDIS_URL ? 'Redis client not initialized' : 'Redis not configured'
    };
  }
  try {
    // Simple ping to check Redis connection
    await redisClient.ping();
    const responseTime = perf_hooks_1.performance.now() - startTime;
    return {
      status: 'UP',
      responseTime: `${responseTime.toFixed(2)}ms`
    };
  }
  catch (error) {
    logger.error('Redis health check failed', error instanceof Error ? error : new Error(String(error)));
    return {
      status: 'DOWN',
      error: error instanceof Error ? error.message : 'Unknown Redis error',
      responseTime: `${(perf_hooks_1.performance.now() - startTime).toFixed(2)}ms`
    };
  }
}
/**
 * Job queue health check
 */
async function checkQueues() {
  try {
    const queueStats = {};
    // Check each queue type
    for (const queueType of Object.values(queue_1.QueueType)) {
      try {
        const queue = (0, queue_1.getQueue)(queueType);
        // Get queue stats
        const [waiting, active, delayed, failed] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getDelayedCount(),
          queue.getFailedCount()
        ]);
        queueStats[queueType] = { waiting, active, delayed, failed };
      }
      catch (error) {
        logger.warn(`Failed to get stats for queue ${queueType}`, error instanceof Error ? error : new Error(String(error)));
        queueStats[queueType] = { waiting: 0, active: 0, delayed: 0, failed: 0 };
      }
    }
    return {
      status: 'UP',
      queues: queueStats
    };
  }
  catch (error) {
    logger.error('Queue health check failed', error instanceof Error ? error : new Error(String(error)));
    return {
      status: 'DEGRADED',
      error: error instanceof Error ? error.message : 'Unknown queue error'
    };
  }
}
/**
 * Metrics endpoint for Prometheus/monitoring systems
 */
router.get('/metrics', async(req, res) => {
  try {
    const metrics = [];
    const timestamp = Math.floor(Date.now() / 1000);
    // System metrics
    metrics.push('# HELP system_uptime_seconds System uptime in seconds');
    metrics.push('# TYPE system_uptime_seconds gauge');
    metrics.push(`system_uptime_seconds ${process.uptime()} ${timestamp}`);
    metrics.push('# HELP system_memory_used_bytes Process memory usage in bytes');
    metrics.push('# TYPE system_memory_used_bytes gauge');
    metrics.push(`system_memory_used_bytes ${process.memoryUsage().rss} ${timestamp}`);
    metrics.push('# HELP system_memory_heap_used_bytes Process heap memory usage in bytes');
    metrics.push('# TYPE system_memory_heap_used_bytes gauge');
    metrics.push(`system_memory_heap_used_bytes ${process.memoryUsage().heapUsed} ${timestamp}`);
    metrics.push('# HELP system_cpu_load_1m System load average 1m');
    metrics.push('# TYPE system_cpu_load_1m gauge');
    metrics.push(`system_cpu_load_1m ${os_1.default.loadavg()[0]} ${timestamp}`);
    // Queue metrics
    for (const queueType of Object.values(queue_1.QueueType)) {
      try {
        const queue = (0, queue_1.getQueue)(queueType);
        // Get queue stats
        const [waiting, active, delayed, failed, completed] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getDelayedCount(),
          queue.getFailedCount(),
          queue.getCompletedCount()
        ]);
        metrics.push(`# HELP queue_${queueType}_waiting_jobs Number of waiting jobs in ${queueType} queue`);
        metrics.push(`# TYPE queue_${queueType}_waiting_jobs gauge`);
        metrics.push(`queue_${queueType}_waiting_jobs ${waiting} ${timestamp}`);
        metrics.push(`# HELP queue_${queueType}_active_jobs Number of active jobs in ${queueType} queue`);
        metrics.push(`# TYPE queue_${queueType}_active_jobs gauge`);
        metrics.push(`queue_${queueType}_active_jobs ${active} ${timestamp}`);
        metrics.push(`# HELP queue_${queueType}_delayed_jobs Number of delayed jobs in ${queueType} queue`);
        metrics.push(`# TYPE queue_${queueType}_delayed_jobs gauge`);
        metrics.push(`queue_${queueType}_delayed_jobs ${delayed} ${timestamp}`);
        metrics.push(`# HELP queue_${queueType}_failed_jobs Number of failed jobs in ${queueType} queue`);
        metrics.push(`# TYPE queue_${queueType}_failed_jobs gauge`);
        metrics.push(`queue_${queueType}_failed_jobs ${failed} ${timestamp}`);
        metrics.push(`# HELP queue_${queueType}_completed_jobs Number of completed jobs in ${queueType} queue`);
        metrics.push(`# TYPE queue_${queueType}_completed_jobs counter`);
        metrics.push(`queue_${queueType}_completed_jobs ${completed} ${timestamp}`);
      }
      catch (error) {
        logger.warn(`Failed to get metrics for queue ${queueType}`, error instanceof Error ? error : new Error(String(error)));
      }
    }
    // Database metrics
    try {
      if (dbPool) {
        const dbStartTime = perf_hooks_1.performance.now();
        await dbPool.query('SELECT 1');
        const dbResponseTime = perf_hooks_1.performance.now() - dbStartTime;
        metrics.push('# HELP db_response_time_milliseconds Database response time in milliseconds');
        metrics.push('# TYPE db_response_time_milliseconds gauge');
        metrics.push(`db_response_time_milliseconds ${dbResponseTime.toFixed(2)} ${timestamp}`);
        metrics.push('# HELP db_status Database availability status (1=up, 0=down)');
        metrics.push('# TYPE db_status gauge');
        metrics.push(`db_status 1 ${timestamp}`);
      }
    }
    catch (error) {
      metrics.push('# HELP db_status Database availability status (1=up, 0=down)');
      metrics.push('# TYPE db_status gauge');
      metrics.push(`db_status 0 ${timestamp}`);
      logger.warn('Failed to collect database metrics', error instanceof Error ? error : new Error(String(error)));
    }
    // Redis metrics
    try {
      const redisClient = (0, redis_1.getRedisClient)();
      if (redisClient) {
        const redisStartTime = perf_hooks_1.performance.now();
        await redisClient.ping();
        const redisResponseTime = perf_hooks_1.performance.now() - redisStartTime;
        metrics.push('# HELP redis_response_time_milliseconds Redis response time in milliseconds');
        metrics.push('# TYPE redis_response_time_milliseconds gauge');
        metrics.push(`redis_response_time_milliseconds ${redisResponseTime.toFixed(2)} ${timestamp}`);
        metrics.push('# HELP redis_status Redis availability status (1=up, 0=down)');
        metrics.push('# TYPE redis_status gauge');
        metrics.push(`redis_status 1 ${timestamp}`);
      }
      else if (process.env.REDIS_URL) {
        metrics.push('# HELP redis_status Redis availability status (1=up, 0=down)');
        metrics.push('# TYPE redis_status gauge');
        metrics.push(`redis_status 0 ${timestamp}`);
      }
    }
    catch (error) {
      metrics.push('# HELP redis_status Redis availability status (1=up, 0=down)');
      metrics.push('# TYPE redis_status gauge');
      metrics.push(`redis_status 0 ${timestamp}`);
      logger.warn('Failed to collect Redis metrics', error instanceof Error ? error : new Error(String(error)));
    }
    // Additional process metrics
    metrics.push('# HELP process_versions Node.js version information');
    metrics.push('# TYPE process_versions gauge');
    metrics.push(`process_versions{version="${process.version}"} 1 ${timestamp}`);
    metrics.push('# HELP process_max_listeners Maximum event listeners allowed');
    metrics.push('# TYPE process_max_listeners gauge');
    metrics.push(`process_max_listeners ${process.getMaxListeners()} ${timestamp}`);
    // HTTP response metrics
    metrics.push('# HELP http_request_duration_milliseconds HTTP request durations in ms');
    metrics.push('# TYPE http_request_duration_milliseconds histogram');
    // Send metrics in Prometheus format
    res.set('Content-Type', 'text/plain');
    res.send(metrics.join('\n'));
  }
  catch (error) {
    logger.error('Error generating metrics', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      error: 'Failed to generate metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
/**
 * Admin-only endpoint for debugging the server's current state
 * This should be protected with strong authentication
 */
router.get('/debug', async(req, res) => {
  // Check if user is admin
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized access' });
  }
  try {
    // Collect debug information
    const debugInfo = {
      env: {
        nodeEnv: process.env.NODE_ENV,
        port: process.env.PORT,
        sentryDsn: process.env.SENTRY_DSN ? '[CONFIGURED]' : '[NOT CONFIGURED]',
        redisUrl: process.env.REDIS_URL ? '[CONFIGURED]' : '[NOT CONFIGURED]'
      },
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        uptime: process.uptime(),
        cpuCount: os_1.default.cpus().length,
        totalMemory: os_1.default.totalmem(),
        freeMemory: os_1.default.freemem(),
        loadAvg: os_1.default.loadavg()
      },
      process: {
        pid: process.pid,
        title: process.title,
        memoryUsage: process.memoryUsage(),
        resourceUsage: process.resourceUsage()
      }
    };
    res.json({
      timestamp: new Date().toISOString(),
      debugInfo
    });
  }
  catch (error) {
    logger.error('Error generating debug info', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      error: 'Failed to generate debug info',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
exports.default = router;
