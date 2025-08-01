// src/server/routes/performance.ts
import { Router, Request, Response } from 'express';
import { getMetrics } from '../../monitoring/metrics.js';
import { getResilienceStatus } from '../../resilience/index.js';
import { getConnectionPool, getPoolStats } from '../../database/connection-pool.js';
import { getRedisClient } from '../../cache/redis.js';
import { getLogger } from '../../logging/index.js';

const router = Router();
const logger = getLogger().child({ component: 'performance-routes' });

/**
 * GET /api/v1/performance/metrics
 * Get Prometheus metrics
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await getMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (error) {
    logger.error('Failed to get metrics', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({ error: 'Failed to retrieve metrics' });
  }
});

/**
 * GET /api/v1/performance/health
 * Get comprehensive system health status
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const resilienceStatus = await getResilienceStatus();
    const pool = getConnectionPool();
    const redis = getRedisClient();

    // Get database pool stats
    const poolStats = await getPoolStats();

    // Get Redis stats if available
    let redisStats = null;
    if (redis) {
      try {
        const info = await redis.info();
        redisStats = {
          connected: true,
          info: info.substring(0, 500) + '...', // Truncate for response
        };
      } catch {
        redisStats = { connected: false };
      }
    }

    // Get memory usage
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        rss: memoryUsage.rss,
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
      database: {
        pool: poolStats,
        healthy: resilienceStatus.systemHealth.database,
      },
      cache: {
        redis: redisStats,
        healthy: resilienceStatus.systemHealth.cache,
      },
      resilience: {
        degradationLevel: resilienceStatus.degradationLevel,
        circuitBreakers: resilienceStatus.circuitBreakers,
      },
    };

    // Determine overall health status
    if (!resilienceStatus.systemHealth.overall) {
      healthStatus.status = 'degraded';
    }

    res.json(healthStatus);
  } catch (error) {
    logger.error('Failed to get health status', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({ 
      status: 'unhealthy',
      error: 'Failed to retrieve health status',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/v1/performance/resilience
 * Get detailed resilience status
 */
router.get('/resilience', async (req: Request, res: Response) => {
  try {
    const resilienceStatus = await getResilienceStatus();
    res.json({
      timestamp: new Date().toISOString(),
      ...resilienceStatus,
    });
  } catch (error) {
    logger.error('Failed to get resilience status', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({ error: 'Failed to retrieve resilience status' });
  }
});

/**
 * POST /api/v1/performance/backup
 * Create a system backup
 */
router.post('/backup', async (req: Request, res: Response) => {
  try {
    const { getDisasterRecoveryManager } = await import('../../resilience/disaster-recovery.js');
    const disasterRecovery = getDisasterRecoveryManager();
    
    const backup = await disasterRecovery.createBackup();
    
    res.json({
      success: backup.success,
      backupId: backup.backupId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to create backup', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

/**
 * GET /api/v1/performance/database/stats
 * Get database performance statistics
 */
router.get('/database/stats', async (req: Request, res: Response) => {
  try {
    const pool = getConnectionPool();
    const poolStats = await getPoolStats();
    
    // Get additional database stats if available
    let tableStats = [];
    let indexStats = [];
    
    try {
      const { DatabaseStats } = await import('../../database/query-optimizer.js');
      tableStats = await DatabaseStats.getTableStats();
      indexStats = await DatabaseStats.getIndexStats();
    } catch (error) {
      logger.debug('Could not get detailed database stats', error instanceof Error ? error : new Error(String(error)));
    }

    res.json({
      timestamp: new Date().toISOString(),
      pool: poolStats,
      tables: tableStats,
      indexes: indexStats,
    });
  } catch (error) {
    logger.error('Failed to get database stats', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({ error: 'Failed to retrieve database statistics' });
  }
});

/**
 * GET /api/v1/performance/cache/stats
 * Get cache performance statistics
 */
router.get('/cache/stats', async (req: Request, res: Response) => {
  try {
    const redis = getRedisClient();
    
    if (!redis) {
      return res.json({
        timestamp: new Date().toISOString(),
        available: false,
        message: 'Redis not configured',
      });
    }

    // Get Redis statistics
    const info = await redis.info();
            const memory = await redis.memory('STATS');
    const keyspace = await redis.info('keyspace');
    
    // Parse Redis info
    const infoLines = info.split('\r\n');
    const stats: Record<string, string> = {};
    
    for (const line of infoLines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        stats[key] = value;
      }
    }

    res.json({
      timestamp: new Date().toISOString(),
      available: true,
      stats: {
        connected_clients: stats.connected_clients,
        used_memory_human: stats.used_memory_human,
        total_commands_processed: stats.total_commands_processed,
        keyspace_hits: stats.keyspace_hits,
        keyspace_misses: stats.keyspace_misses,
        hit_rate: stats.keyspace_hits && stats.keyspace_misses ? 
          (parseInt(stats.keyspace_hits) / (parseInt(stats.keyspace_hits) + parseInt(stats.keyspace_misses)) * 100).toFixed(2) + '%' : 'N/A',
      },
      memory: memory,
      keyspace: keyspace,
    });
  } catch (error) {
    logger.error('Failed to get cache stats', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({ error: 'Failed to retrieve cache statistics' });
  }
});

/**
 * POST /api/v1/performance/reset-circuit-breakers
 * Reset all circuit breakers
 */
router.post('/reset-circuit-breakers', async (req: Request, res: Response) => {
  try {
    const { CircuitBreakerFactory } = await import('../../resilience/circuit-breaker.js');
    CircuitBreakerFactory.resetAll();
    
    logger.info('All circuit breakers reset');
    res.json({
      success: true,
      message: 'All circuit breakers reset successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to reset circuit breakers', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({ error: 'Failed to reset circuit breakers' });
  }
});

export default router; 