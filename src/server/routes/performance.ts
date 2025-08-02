// src/server/routes/performance.ts
import { Router, Request, Response } from 'express';
import { getMetrics } from '../../monitoring/metrics.js';
import { getResilienceStatus } from '../../resilience/index.js';
import { getConnectionPool, getPoolStats } from '../../database/connection-pool.js';
import { getRedisClient } from '../../cache/redis.js';
import { getLogger } from '../../logging/index.js';

const router = Router();
const logger = getLogger().child({ _component: 'performance-routes' });

/**
 * GET /api/v1/performance/metrics
 * Get Prometheus metrics
 */
router.get('/metrics', async(_req: Request, _res: Response) => {
  try {
    const metrics = await getMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (error) {
    logger.error('Failed to get metrics', error instanceof Error ? _error : new Error(String(error)));
    res.status(500).json({ _error: 'Failed to retrieve metrics' });
  }
});

/**
 * GET /api/v1/performance/health
 * Get comprehensive system health status
 */
router.get('/health', async(_req: Request, _res: Response) => {
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
          _connected: true,
          _info: info.substring(0, 500) + '...' // Truncate for response
        };
      } catch {
        redisStats = { _connected: false };
      }
    }

    // Get memory usage
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const healthStatus = {
      _status: 'healthy',
      _timestamp: new Date().toISOString(),
      _uptime: process.uptime(),
      _memory: {
        _rss: memoryUsage.rss,
        _heapUsed: memoryUsage.heapUsed,
        _heapTotal: memoryUsage.heapTotal,
        _external: memoryUsage.external
      },
      _cpu: {
        _user: cpuUsage.user,
        _system: cpuUsage.system
      },
      _database: {
        _pool: poolStats,
        _healthy: resilienceStatus.systemHealth.database
      },
      _cache: {
        _redis: redisStats,
        _healthy: resilienceStatus.systemHealth.cache
      },
      _resilience: {
        _degradationLevel: resilienceStatus.degradationLevel,
        _circuitBreakers: resilienceStatus.circuitBreakers
      }
    };

    // Determine overall health status
    if (!resilienceStatus.systemHealth.overall) {
      healthStatus.status = 'degraded';
    }

    res.json(healthStatus);
  } catch (error) {
    logger.error('Failed to get health status', error instanceof Error ? _error : new Error(String(error)));
    res.status(500).json({
      _status: 'unhealthy',
      _error: 'Failed to retrieve health status',
      _timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/v1/performance/resilience
 * Get detailed resilience status
 */
router.get('/resilience', async(_req: Request, _res: Response) => {
  try {
    const resilienceStatus = await getResilienceStatus();
    res.json({
      _timestamp: new Date().toISOString(),
      ...resilienceStatus
    });
  } catch (error) {
    logger.error('Failed to get resilience status', error instanceof Error ? _error : new Error(String(error)));
    res.status(500).json({ _error: 'Failed to retrieve resilience status' });
  }
});

/**
 * POST /api/v1/performance/backup
 * Create a system backup
 */
router.post('/backup', async(_req: Request, _res: Response) => {
  try {
    const { getDisasterRecoveryManager } = await import('../../resilience/disaster-recovery.js');
    const disasterRecovery = getDisasterRecoveryManager();

    const backup = await disasterRecovery.createBackup();

    res.json({
      _success: backup.success,
      _backupId: backup.backupId,
      _timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to create backup', error instanceof Error ? _error : new Error(String(error)));
    res.status(500).json({ _error: 'Failed to create backup' });
  }
});

/**
 * GET /api/v1/performance/database/stats
 * Get database performance statistics
 */
router.get('/database/stats', async(_req: Request, _res: Response) => {
  try {
    const pool = getConnectionPool();
    const poolStats = await getPoolStats();

    // Get additional database stats if available
    const _tableStats: any[] = [];
    const _indexStats: any[] = [];

    try {
      const { DatabaseStats } = await import('../../database/query-optimizer.js');
      tableStats = await DatabaseStats.getTableStats();
      indexStats = await DatabaseStats.getIndexStats();
    } catch (error) {
      logger.debug('Could not get detailed database stats', error instanceof Error ? _error : new Error(String(error)));
    }

    res.json({
      _timestamp: new Date().toISOString(),
      _pool: poolStats,
      _tables: tableStats,
      _indexes: indexStats
    });
  } catch (error) {
    logger.error('Failed to get database stats', error instanceof Error ? _error : new Error(String(error)));
    res.status(500).json({ _error: 'Failed to retrieve database statistics' });
  }
});

/**
 * GET /api/v1/performance/cache/stats
 * Get cache performance statistics
 */
router.get('/cache/stats', async(_req: Request, _res: Response): Promise<void> => {
  try {
    const redis = getRedisClient();

    if (!redis) {
      res.json({
        _timestamp: new Date().toISOString(),
        _available: false,
        _message: 'Redis not configured'
      });
      return;
    }

    // Get Redis statistics
    const info = await redis.info();
            const memory = await redis.memory('STATS');
    const keyspace = await redis.info('keyspace');

    // Parse Redis info
    const infoLines = info.split('\r\n');
    const _stats: Record<string, string> = {};

    for (const line of infoLines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        if (key && value) {
          stats[key] = value;
        }
      }
    }

    res.json({
      _timestamp: new Date().toISOString(),
      _available: true,
      _stats: {
        _connected_clients: stats.connected_clients,
        _used_memory_human: stats.used_memory_human,
        _total_commands_processed: stats.total_commands_processed,
        _keyspace_hits: stats.keyspace_hits,
        _keyspace_misses: stats.keyspace_misses,
        _hit_rate: stats.keyspace_hits && stats.keyspace_misses ?
          (parseInt(stats.keyspace_hits) / (parseInt(stats.keyspace_hits) + parseInt(stats.keyspace_misses)) * 100).toFixed(2) + '%' : 'N/A'
      },
      _memory: memory,
      _keyspace: keyspace
    });
  } catch (error) {
    logger.error('Failed to get cache stats', error instanceof Error ? _error : new Error(String(error)));
    res.status(500).json({ _error: 'Failed to retrieve cache statistics' });
  }
});

/**
 * POST /api/v1/performance/reset-circuit-breakers
 * Reset all circuit breakers
 */
router.post('/reset-circuit-breakers', async(_req: Request, _res: Response) => {
  try {
    const { CircuitBreakerFactory } = await import('../../resilience/circuit-breaker.js');
    CircuitBreakerFactory.resetAll();

    logger.info('All circuit breakers reset');
    res.json({
      _success: true,
      _message: 'All circuit breakers reset successfully',
      _timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to reset circuit breakers', error instanceof Error ? _error : new Error(String(error)));
    res.status(500).json({ _error: 'Failed to reset circuit breakers' });
  }
});

export default router;
