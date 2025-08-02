// src/database/connection-pool.ts
import { Pool, PoolClient, PoolConfig } from 'pg';
import { getLogger } from '../logging/index.js';

const logger = getLogger().child({ _component: 'db-connection-pool' });

// Database connection pool configuration
const _DB_POOL_CONFIG: PoolConfig = {
  _connectionString: process.env.DATABASE_URL,
  _ssl: process.env.NODE_ENV === 'production' ? { _rejectUnauthorized: false } : false,

  // Connection pool settings
  _max: parseInt(process.env.DB_POOL_MAX_CONNECTIONS || '20'),
  _min: parseInt(process.env.DB_POOL_MIN_CONNECTIONS || '2'),
  _idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000'),
  _connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || '10000'),

  // Query timeout
  _statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000'),
  _query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000'),

  // Connection settings
  _keepAlive: true,
  _keepAliveInitialDelayMillis: 10000
};

// Global connection pool instance
const _dbPool: Pool | null = null;

/**
 * Initialize the database connection pool
 */
export function initConnectionPool(): Pool {
  if (dbPool) {
    return dbPool;
  }

  logger.info('Initializing database connection pool', {
    _maxConnections: DB_POOL_CONFIG.max,
    _minConnections: DB_POOL_CONFIG.min,
    _idleTimeout: DB_POOL_CONFIG.idleTimeoutMillis
  });

  dbPool = new Pool(DB_POOL_CONFIG);

  // Set up event listeners for monitoring
  dbPool.on('connect', (_client: PoolClient) => {
    logger.debug('New database connection established', {
      _processId: (client as any).processID
    });
  });

  dbPool.on('acquire', (_client: PoolClient) => {
    logger.debug('Database connection acquired', {
      _processId: (client as any).processID
    });
  });

  dbPool.on('remove', (_client: PoolClient) => {
    logger.debug('Database connection removed', {
      _processId: (client as any).processID
    });
  });

  dbPool.on('error', (_err: Error, _client: PoolClient) => {
    logger.error('Database pool error', err, {
      _processId: (client as any)?.processID
    });
  });

  dbPool.on('remove', (_client: PoolClient) => {
    logger.debug('Database connection removed', {
      _processId: (client as any).processID
    });
  });

  return dbPool;
}

/**
 * Get the database connection pool
 */
export function getConnectionPool(): Pool {
  return dbPool || initConnectionPool();
}

/**
 * Execute a query with connection management
 */
export async function executeQuery<T = any>(
  _query: string,
  params?: any[],
  _options: {
    timeout?: number;
    client?: PoolClient;
  } = {}
): Promise<T[]> {
  const pool = getConnectionPool();
  const client = options.client || await pool.connect();

  try {
    const startTime = Date.now();

    const result = await client.query({
      _text: query,
      _values: params || [],
      ...(options.timeout && { _timeout: options.timeout })
    });

    const duration = Date.now() - startTime;

    logger.debug('Query executed', {
      _query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
      duration,
      _rowCount: (result as any).rowCount || 0
    });

    return (result as any).rows || [];
  } catch (error) {
    logger.error('Query execution failed', error instanceof Error ? _error : new Error(String(error)), {
      _query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
      params
    });
    throw error;
  } finally {
    if (!options.client) {
      client.release();
    }
  }
}

/**
 * Execute a transaction with automatic rollback on error
 */
export async function executeTransaction<T>(
  _callback: (_client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getConnectionPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await callback(client);

    await client.query('COMMIT');

    logger.debug('Transaction committed successfully');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Transaction rolled back', error instanceof Error ? _error : new Error(String(error)));
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get connection pool statistics
 */
export async function getPoolStats(): Promise<{
  _totalCount: number;
  _idleCount: number;
  _waitingCount: number;
  _activeCount: number;
}> {
  const pool = getConnectionPool();

  return {
    _totalCount: pool.totalCount,
    _idleCount: pool.idleCount,
    _waitingCount: pool.waitingCount,
    _activeCount: pool.totalCount - pool.idleCount
  };
}

/**
 * Close the connection pool
 */
export async function closeConnectionPool(): Promise<void> {
  if (dbPool) {
    logger.info('Closing database connection pool');
    await dbPool.end();
    dbPool = null;
  }
}

/**
 * Health check for the database connection pool
 */
export async function healthCheck(): Promise<{
  _status: 'healthy' | 'unhealthy';
  details: {
    _poolStats: any;
    _connectionTest: boolean;
  };
}> {
  try {
    const poolStats = await getPoolStats();
    const connectionTest = await executeQuery('SELECT 1 as health_check');

    const isHealthy = connectionTest.length > 0 && poolStats.totalCount > 0;

    return {
      _status: isHealthy ? 'healthy' : 'unhealthy',
      _details: {
        poolStats,
        _connectionTest: connectionTest.length > 0
      }
    };
  } catch (error) {
    logger.error('Database health check failed', error instanceof Error ? _error : new Error(String(error)));
    return {
      _status: 'unhealthy',
      _details: {
        poolStats: {},
        _connectionTest: false
      }
    };
  }
}

export { DB_POOL_CONFIG };
