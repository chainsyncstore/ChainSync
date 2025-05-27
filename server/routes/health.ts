// server/routes/health.ts
import { Router, Request, Response } from 'express';
import { getLogger } from '../../src/logging';
import { getRedisClient } from '../../src/cache/redis';
import { getQueue, QueueType } from '../../src/queue';
import { performance } from 'perf_hooks';
import os from 'os';
import { dbManager } from '../../db';
import { CircuitBreaker } from '../utils/fallback';

// Get logger for health routes
const logger = getLogger().child({ component: 'health-routes' });

// Create router
const router = Router();

// Circuit breakers registry to track system status
const circuitBreakers: Record<string, CircuitBreaker> = {};

export function registerCircuitBreaker(name: string, circuitBreaker: CircuitBreaker): void {
  circuitBreakers[name] = circuitBreaker;
  logger.info(`Circuit breaker registered: ${name}`);
}

/**
 * Basic health check
 * Returns 200 OK if the application is running
 */
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString()
  });
});

/**
 * Kubernetes-style liveness probe
 * Indicates if the application is running
 */
router.get('/healthz', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString()
  });
});

/**
 * Kubernetes-style readiness probe
 * Indicates if the application is ready to accept traffic
 */
router.get('/readyz', async (req: Request, res: Response) => {
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
  } catch (error) {
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
/**
 * Get circuit breaker status
 */
function getCircuitBreakersStatus(): { status: string; breakers: Record<string, any> } {
  const breakerStatus: Record<string, any> = {};
  let overallStatus = 'UP';
  
  for (const [name, breaker] of Object.entries(circuitBreakers)) {
    const state = breaker.getState();
    breakerStatus[name] = {
      status: state.status,
      failureCount: state.failureCount,
      openedAt: state.openedAt ? new Date(state.openedAt).toISOString() : null
    };
    
    if (state.status === 'OPEN') {
      overallStatus = 'DEGRADED';
    }
  }
  
  return {
    status: overallStatus,
    breakers: breakerStatus
  };
}

router.get('/health/details', async (req: Request, res: Response) => {
  const startTime = performance.now();
  
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
      cpuLoad: os.loadavg(),
      totalMemory: os.totalmem(),
      freeMemory: os.freemem()
    };
    
    // Get circuit breakers status
    const circuitBreakerStatus = getCircuitBreakersStatus();
    
    // Overall status
    const overallStatus = dbStatus.status === 'UP' && 
                          redisStatus.status === 'UP' &&
                          circuitBreakerStatus.status === 'UP' ? 
                          'UP' : 'DEGRADED';
    
    // Calculate response time
    const responseTime = performance.now() - startTime;
    
    res.status(overallStatus === 'UP' ? 200 : 207).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime.toFixed(2)}ms`,
      services: {
        database: dbStatus,
        redis: redisStatus,
        queues: queueStatus,
        circuitBreakers: circuitBreakerStatus.breakers
      },
      system: systemInfo
    });
  } catch (error) {
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
async function checkDatabase(): Promise<{ status: string; responseTime?: string; poolStats?: any; error?: string }> {
  const startTime = performance.now();
  
  try {
    // Use our connection manager to get pool stats
    const poolStats = await dbManager.getPoolStats();
    
    // Simple query to check database connection
    await dbManager.executeQuery(
      (db) => db.execute('SELECT 1'),
      'health-check'
    );
    
    const responseTime = performance.now() - startTime;
    
    return {
      status: 'UP',
      responseTime: `${responseTime.toFixed(2)}ms`,
      poolStats
    };
  } catch (error) {
    logger.error('Database health check failed', error instanceof Error ? error : new Error(String(error)));
    
    return {
      status: 'DOWN',
      error: error instanceof Error ? error.message : 'Unknown database error',
      responseTime: `${(performance.now() - startTime).toFixed(2)}ms`
    };
  }
}

/**
 * Redis health check
 */
async function checkRedis(): Promise<{ status: string; responseTime?: string; error?: string }> {
  const startTime = performance.now();
  const redisClient = getRedisClient();
  
  if (!redisClient) {
    return { 
      status: process.env.REDIS_URL ? 'DOWN' : 'DISABLED',
      error: process.env.REDIS_URL ? 'Redis client not initialized' : 'Redis not configured'
    };
  }
  
  try {
    // Simple ping to check Redis connection
    await redisClient.ping();
    const responseTime = performance.now() - startTime;
    
    return {
      status: 'UP',
      responseTime: `${responseTime.toFixed(2)}ms`
    };
  } catch (error) {
    logger.error('Redis health check failed', error instanceof Error ? error : new Error(String(error)));
    
    return {
      status: 'DOWN',
      error: error instanceof Error ? error.message : 'Unknown Redis error',
      responseTime: `${(performance.now() - startTime).toFixed(2)}ms`
    };
  }
}

/**
 * Job queue health check
 */
async function checkQueues(): Promise<{ 
  status: string; 
  queues?: Record<string, { waiting: number; active: number; delayed: number; failed: number }>;
  error?: string;
}> {
  try {
    const queueStats: Record<string, { waiting: number; active: number; delayed: number; failed: number }> = {};
    
    // Check each queue type
    for (const queueType of Object.values(QueueType)) {
      try {
        const queue = getQueue(queueType);
        
        // Get queue stats
        const [waiting, active, delayed, failed] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getDelayedCount(),
          queue.getFailedCount()
        ]);
        
        queueStats[queueType] = { waiting, active, delayed, failed };
      } catch (error) {
        logger.warn(`Failed to get stats for queue ${queueType}`, error instanceof Error ? error : new Error(String(error)));
        queueStats[queueType] = { waiting: 0, active: 0, delayed: 0, failed: 0 };
      }
    }
    
    return {
      status: 'UP',
      queues: queueStats
    };
  } catch (error) {
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
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics: string[] = [];
    const timestamp = Math.floor(Date.now() / 1000);
    
    // System metrics
    metrics.push(`# HELP system_uptime_seconds System uptime in seconds`);
    metrics.push(`# TYPE system_uptime_seconds gauge`);
    metrics.push(`system_uptime_seconds ${process.uptime()} ${timestamp}`);
    
    metrics.push(`# HELP system_memory_used_bytes Process memory usage in bytes`);
    metrics.push(`# TYPE system_memory_used_bytes gauge`);
    metrics.push(`system_memory_used_bytes ${process.memoryUsage().rss} ${timestamp}`);
    
    metrics.push(`# HELP system_memory_heap_used_bytes Process heap memory usage in bytes`);
    metrics.push(`# TYPE system_memory_heap_used_bytes gauge`);
    metrics.push(`system_memory_heap_used_bytes ${process.memoryUsage().heapUsed} ${timestamp}`);
    
    metrics.push(`# HELP system_cpu_load_1m System load average 1m`);
    metrics.push(`# TYPE system_cpu_load_1m gauge`);
    metrics.push(`system_cpu_load_1m ${os.loadavg()[0]} ${timestamp}`);
    
    metrics.push(`# HELP system_memory_total_bytes Total system memory in bytes`);
    metrics.push(`# TYPE system_memory_total_bytes gauge`);
    metrics.push(`system_memory_total_bytes ${os.totalmem()} ${timestamp}`);
    
    metrics.push(`# HELP system_memory_free_bytes Free system memory in bytes`);
    metrics.push(`# TYPE system_memory_free_bytes gauge`);
    metrics.push(`system_memory_free_bytes ${os.freemem()} ${timestamp}`);
    
    metrics.push(`# HELP system_load_1m System load average 1m`);
    metrics.push(`# TYPE system_load_1m gauge`);
    metrics.push(`system_load_1m ${os.loadavg()[0]} ${timestamp}`);
    
    metrics.push(`# HELP system_load_5m System load average 5m`);
    metrics.push(`# TYPE system_load_5m gauge`);
    metrics.push(`system_load_5m ${os.loadavg()[1]} ${timestamp}`);
    
    metrics.push(`# HELP system_load_15m System load average 15m`);
    metrics.push(`# TYPE system_load_15m gauge`);
    metrics.push(`system_load_15m ${os.loadavg()[2]} ${timestamp}`);
    
    // Process metrics
    const memoryUsage = process.memoryUsage();
    metrics.push(`# HELP process_memory_rss_bytes Process RSS memory usage in bytes`);
    metrics.push(`# TYPE process_memory_rss_bytes gauge`);
    metrics.push(`process_memory_rss_bytes ${memoryUsage.rss} ${timestamp}`);
    
    metrics.push(`# HELP process_memory_heap_total_bytes Process heap total memory usage in bytes`);
    metrics.push(`# TYPE process_memory_heap_total_bytes gauge`);
    metrics.push(`process_memory_heap_total_bytes ${memoryUsage.heapTotal} ${timestamp}`);
    
    metrics.push(`# HELP process_memory_heap_used_bytes Process heap used memory usage in bytes`);
    metrics.push(`# TYPE process_memory_heap_used_bytes gauge`);
    metrics.push(`process_memory_heap_used_bytes ${memoryUsage.heapUsed} ${timestamp}`);
    
    metrics.push(`# HELP process_memory_external_bytes Process external memory usage in bytes`);
    metrics.push(`# TYPE process_memory_external_bytes gauge`);
    metrics.push(`process_memory_external_bytes ${memoryUsage.external} ${timestamp}`);
    
    metrics.push(`# HELP process_uptime_seconds Process uptime in seconds`);
    metrics.push(`# TYPE process_uptime_seconds gauge`);
    metrics.push(`process_uptime_seconds ${process.uptime()} ${timestamp}`);
    
    // Queue metrics
    const queueResult = await checkQueues();
    if (queueResult.queues) {
      for (const [queueType, stats] of Object.entries(queueResult.queues)) {
        metrics.push(`# HELP queue_${queueType}_waiting_jobs Number of waiting jobs in ${queueType} queue`);
        metrics.push(`# TYPE queue_${queueType}_waiting_jobs gauge`);
        metrics.push(`queue_${queueType}_waiting_jobs ${stats.waiting} ${timestamp}`);

        metrics.push(`# HELP queue_${queueType}_active_jobs Number of active jobs in ${queueType} queue`);
        metrics.push(`# TYPE queue_${queueType}_active_jobs gauge`);
        metrics.push(`queue_${queueType}_active_jobs ${stats.active} ${timestamp}`);

        metrics.push(`# HELP queue_${queueType}_delayed_jobs Number of delayed jobs in ${queueType} queue`);
        metrics.push(`# TYPE queue_${queueType}_delayed_jobs gauge`);
        metrics.push(`queue_${queueType}_delayed_jobs ${stats.delayed} ${timestamp}`);

        metrics.push(`# HELP queue_${queueType}_failed_jobs Number of failed jobs in ${queueType} queue`);
        metrics.push(`# TYPE queue_${queueType}_failed_jobs gauge`);
        metrics.push(`queue_${queueType}_failed_jobs ${stats.failed} ${timestamp}`);
      }
    }
    
    // Database metrics
    try {
      // Get database stats from connection manager
      const dbStats = await dbManager.getPoolStats();
      metrics.push(`db_active_connections ${dbStats.activeConnections} ${timestamp}`);
      metrics.push(`db_idle_connections ${dbStats.idleConnections} ${timestamp}`);
      metrics.push(`db_total_connections ${dbStats.totalConnections} ${timestamp}`);
      metrics.push(`db_waiting_clients ${dbStats.waitingClients} ${timestamp}`);
      metrics.push(`db_query_count ${dbStats.queryCount} ${timestamp}`);
      metrics.push(`db_avg_query_time_ms ${dbStats.avgQueryTimeMs} ${timestamp}`);
      
      // Add database latency metric
      const dbStartTime = performance.now();
      await dbManager.executeQuery(db => db.execute('SELECT 1'), 'metrics-latency-check');
      const dbLatency = performance.now() - dbStartTime;
      metrics.push(`db_query_latency_ms ${dbLatency.toFixed(2)} ${timestamp}`);
    } catch (error) {
      metrics.push(`# HELP db_status Database availability status (1=up, 0=down)`);
      metrics.push(`# TYPE db_status gauge`);
      metrics.push(`db_status 0 ${timestamp}`);
      
      logger.warn('Failed to collect database metrics', error instanceof Error ? error : new Error(String(error)));
    }
    
    // Redis metrics
    try {
      const redisClient = getRedisClient();
      if (redisClient) {
        const redisStartTime = performance.now();
        await redisClient.ping();
        const redisResponseTime = performance.now() - redisStartTime;
        
        metrics.push(`# HELP redis_response_time_milliseconds Redis response time in milliseconds`);
        metrics.push(`# TYPE redis_response_time_milliseconds gauge`);
        metrics.push(`redis_response_time_milliseconds ${redisResponseTime.toFixed(2)} ${timestamp}`);
        
        metrics.push(`# HELP redis_status Redis availability status (1=up, 0=down)`);
        metrics.push(`# TYPE redis_status gauge`);
        metrics.push(`redis_status 1 ${timestamp}`);
      } else if (process.env.REDIS_URL) {
        metrics.push(`# HELP redis_status Redis availability status (1=up, 0=down)`);
        metrics.push(`# TYPE redis_status gauge`);
        metrics.push(`redis_status 0 ${timestamp}`);
      }
    } catch (error) {
      metrics.push(`# HELP redis_status Redis availability status (1=up, 0=down)`);
      metrics.push(`# TYPE redis_status gauge`);
      metrics.push(`redis_status 0 ${timestamp}`);
      
      logger.warn('Failed to collect Redis metrics', error instanceof Error ? error : new Error(String(error)));
    }
    
    // Additional process metrics
    metrics.push(`# HELP process_versions Node.js version information`);
    metrics.push(`# TYPE process_versions gauge`);
    metrics.push(`process_versions{version="${process.version}"} 1 ${timestamp}`);
    
    metrics.push(`# HELP process_max_listeners Maximum event listeners allowed`);
    metrics.push(`# TYPE process_max_listeners gauge`);
    metrics.push(`process_max_listeners ${process.getMaxListeners()} ${timestamp}`);
    
    // HTTP response metrics
    metrics.push(`# HELP http_request_duration_milliseconds HTTP request durations in ms`);
    metrics.push(`# TYPE http_request_duration_milliseconds histogram`);
    
    // Send metrics in Prometheus format
    res.set('Content-Type', 'text/plain');
    res.send(metrics.join('\n'));
  } catch (error) {
    logger.error('Error generating metrics', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      error: 'Failed to generate metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Performance health endpoint
router.get('/health/performance', async (req: Request, res: Response) => {
  try {
    // Get database metrics
    const dbStats = await dbManager.getPoolStats();
    
    // Get memory usage
    const memoryUsage = process.memoryUsage();
    
    // Get CPU usage
    const cpuLoad = os.loadavg();
    
    // Get OS metrics
    const osInfo = {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      uptime: os.uptime()
    };
    
    res.status(200).json({
      timestamp: new Date().toISOString(),
      process: {
        memoryUsage: {
          rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
          heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
          external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
        },
        uptime: process.uptime(),
        cpuLoad: cpuLoad
      },
      database: dbStats,
      os: osInfo
    });
  } catch (error) {
    logger.error('Error in performance metrics endpoint', error instanceof Error ? error : new Error(String(error)));
    
    res.status(500).json({
      error: 'Failed to retrieve performance metrics',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Admin-only endpoint for debugging the server's current state
 * This should be protected with strong authentication
 */
router.get('/debug', async (req: Request, res: Response) => {
  // Check if user is admin
  if (!(req as any).user?.isAdmin) {
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
        cpuCount: os.cpus().length,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        loadAvg: os.loadavg()
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
  } catch (error) {
    logger.error('Error generating debug info', error instanceof Error ? error : new Error(String(error)));
    
    res.status(500).json({
      error: 'Failed to generate debug info',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
