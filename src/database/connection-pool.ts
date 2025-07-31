// src/database/connection-pool.ts
import { Pool, PoolClient, PoolConfig } from 'pg';
import { getLogger } from '../logging/index.js';

const logger = getLogger().child({ component: 'db-connection-pool' });

// Database connection pool configuration
const DB_POOL_CONFIG: PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  
  // Connection pool settings
  max: parseInt(process.env.DB_POOL_MAX_CONNECTIONS || '20'),
  min: parseInt(process.env.DB_POOL_MIN_CONNECTIONS || '2'),
  idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000'),
  connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || '10000'),
  
  // Query timeout
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000'),
  query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000'),
  
  // Connection settings
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
};

// Global connection pool instance
let dbPool: Pool | null = null;

/**
 * Initialize the database connection pool
 */
export function initConnectionPool(): Pool {
  if (dbPool) {
    return dbPool;
  }
  
  logger.info('Initializing database connection pool', {
    maxConnections: DB_POOL_CONFIG.max,
    minConnections: DB_POOL_CONFIG.min,
    idleTimeout: DB_POOL_CONFIG.idleTimeoutMillis,
  });
  
  dbPool = new Pool(DB_POOL_CONFIG);
  
  // Set up event listeners for monitoring
  dbPool.on('connect', (client: PoolClient) => {
    logger.debug('New database connection established', {
      processId: client.processID,
    });
  });
  
  dbPool.on('acquire', (client: PoolClient) => {
    logger.debug('Database connection acquired', {
      processId: client.processID,
    });
  });
  
  dbPool.on('release', (client: PoolClient) => {
    logger.debug('Database connection released', {
      processId: client.processID,
    });
  });
  
  dbPool.on('error', (err: Error, client: PoolClient) => {
    logger.error('Database pool error', err, {
      processId: client?.processID,
    });
  });
  
  dbPool.on('remove', (client: PoolClient) => {
    logger.debug('Database connection removed', {
      processId: client.processID,
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
  query: string,
  params?: any[],
  options: {
    timeout?: number;
    client?: PoolClient;
  } = {}
): Promise<T[]> {
  const pool = getConnectionPool();
  const client = options.client || await pool.connect();
  
  try {
    const startTime = Date.now();
    
    const result = await client.query({
      text: query,
      values: params,
      ...(options.timeout && { timeout: options.timeout }),
    });
    
    const duration = Date.now() - startTime;
    
    logger.debug('Query executed', {
      query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
      duration,
      rowCount: result.rowCount,
    });
    
    return result.rows;
  } catch (error) {
    logger.error('Query execution failed', error instanceof Error ? error : new Error(String(error)), {
      query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
      params,
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
  callback: (client: PoolClient) => Promise<T>
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
    logger.error('Transaction rolled back', error instanceof Error ? error : new Error(String(error)));
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get connection pool statistics
 */
export async function getPoolStats(): Promise<{
  totalCount: number;
  idleCount: number;
  waitingCount: number;
  activeCount: number;
}> {
  const pool = getConnectionPool();
  
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    activeCount: pool.totalCount - pool.idleCount,
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
  status: 'healthy' | 'unhealthy';
  details: {
    poolStats: any;
    connectionTest: boolean;
  };
}> {
  try {
    const poolStats = await getPoolStats();
    const connectionTest = await executeQuery('SELECT 1 as health_check');
    
    const isHealthy = connectionTest.length > 0 && poolStats.totalCount > 0;
    
    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      details: {
        poolStats,
        connectionTest: connectionTest.length > 0,
      },
    };
  } catch (error) {
    logger.error('Database health check failed', error instanceof Error ? error : new Error(String(error)));
    return {
      status: 'unhealthy',
      details: {
        poolStats: {},
        connectionTest: false,
      },
    };
  }
}

export { DB_POOL_CONFIG }; 