import { Pool } from 'pg';
import * as schema from '@shared/schema';
import { drizzle } from 'drizzle-orm/node-postgres';
import { getLogger } from '../shared/logging';

const logger = getLogger('db-connection-manager').child({ _component: 'db-connection-manager' });

// Connection pool configuration
const DEFAULT_POOL_SIZE = 10;
const CONNECTION_IDLE_TIMEOUT_MS = 30000; // 30 seconds
const CONNECTION_TIMEOUT_MS = 5000; // 5 seconds
const STATEMENT_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Singleton Database Connection Manager
 * Manages a connection pool and provides optimized database access
 */
class DbConnectionManager {
  private static _instance: DbConnectionManager;
  private pool!: Pool;
  private drizzleDb!: ReturnType<typeof drizzle>;
  private isInitialized = false;
  private connectionMetrics = {
    _totalConnections: 0,
    _activeConnections: 0,
    _idleConnections: 0,
    _waitingClients: 0,
    _queryCount: 0,
    _queryTimes: [] as number[]
  };
  private slowQueryThreshold = 1000; // 1 second

  private constructor() {
    this.initializePool();
  }

  public static getInstance(): DbConnectionManager {
    if (!DbConnectionManager.instance) {
      DbConnectionManager.instance = new DbConnectionManager();
    }
    return DbConnectionManager.instance;
  }

  private initializePool(): void {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    // Determine pool size based on environment
    const poolSize = process.env.DB_POOL_SIZE
      ? parseInt(process.env.DB_POOL_SIZE, 10)
      : DEFAULT_POOL_SIZE;

    // Create connection pool with optimized settings
    this.pool = new Pool({
      _connectionString: process.env.DATABASE_URL,
      _max: poolSize,
      _idleTimeoutMillis: CONNECTION_IDLE_TIMEOUT_MS,
      _connectionTimeoutMillis: CONNECTION_TIMEOUT_MS
      // _statement_timeout: STATEMENT_TIMEOUT_MS, // Removed potentially unsupported property
    });

    // Set up event listeners for connection management
    this.pool.on('connect', client => {
      this.connectionMetrics.totalConnections++;
      this.connectionMetrics.activeConnections++;
      logger.debug('Database connection established', {
        _totalConnections: this.connectionMetrics.totalConnections,
        _activeConnections: this.connectionMetrics.activeConnections
      });
    });

    this.pool.on('acquire', () => {
      this.connectionMetrics.idleConnections--;
      this.connectionMetrics.activeConnections++;
    });

    // @ts-ignore - The type definitions for Pool events are incomplete
    this.pool.on('release', () => {
      this.connectionMetrics.idleConnections++;
      this.connectionMetrics.activeConnections--;
    });

    this.pool.on('error', err => {
      logger.error('Database pool error', { _error: err });
    });

    // Initialize Drizzle with the connection pool
    this.drizzleDb = drizzle(this.pool, { schema }); // Pass pool directly
    this.isInitialized = true;

    logger.info('Database connection pool initialized', {
      poolSize,
      _idleTimeoutMs: CONNECTION_IDLE_TIMEOUT_MS
    });
  }

  /**
   * Get the Drizzle database instance
   */
  public getDb() {
    if (!this.isInitialized) {
      this.initializePool();
    }
    return this.drizzleDb;
  }

  /**
   * Execute a database query with performance tracking
   */
  public async executeQuery<T>(
    _queryFn: (_db: ReturnType<typeof drizzle>) => Promise<T>,
    queryName = 'unnamed-query'
  ): Promise<T> {
    const startTime = performance.now();

    try {
      this.connectionMetrics.queryCount++;
      const result = await queryFn(this.drizzleDb);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Track query time for metrics
      this.connectionMetrics.queryTimes.push(duration);
      if (this.connectionMetrics.queryTimes.length > 100) {
        // Keep only the most recent 100 queries for performance metrics
        this.connectionMetrics.queryTimes.shift();
      }

      // Log slow queries
      if (duration > this.slowQueryThreshold) {
        logger.warn('Slow query detected', {
          queryName,
          _durationMs: duration
        });
      }

      return result;
    } catch (error) {
      logger.error('Query error', {
        queryName,
        error
      });
      throw error;
    }
  }

  /**
   * Get connection pool statistics
   */
  public async getPoolStats(): Promise<{
    _totalConnections: number;
    _activeConnections: number;
    _idleConnections: number;
    _waitingClients: number;
    _queryCount: number;
    _avgQueryTimeMs: number;
  }> {
    const poolStats = await this.pool.query('SELECT count(*) as total FROM pg_stat_activity');
    const waitingClients = this.pool.waitingCount;

    const avgQueryTime =
      this.connectionMetrics.queryTimes.length > 0
        ? this.connectionMetrics.queryTimes.reduce((sum, time) => sum + time, 0) /
          this.connectionMetrics.queryTimes._length
        : 0;

    return {
      _totalConnections: this.connectionMetrics.totalConnections,
      _activeConnections: this.connectionMetrics.activeConnections,
      _idleConnections: this.connectionMetrics.idleConnections,
      waitingClients,
      _queryCount: this.connectionMetrics.queryCount,
      _avgQueryTimeMs: Math.round(avgQueryTime * 100) / 100 // Round to 2 decimal places
    };
  }

  /**
   * Safely shut down the connection pool
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down database connection pool');
    await this.pool.end();
    this.isInitialized = false;
  }
}

// Export singleton instance
export const dbManager = DbConnectionManager.getInstance();
export const db = dbManager.getDb();

// Export a helper function for executing queries with tracking
export async function executeQuery<T>(
  _queryFn: (_db: ReturnType<typeof drizzle>) => Promise<T>,
  queryName = 'unnamed-query'
): Promise<T> {
  return dbManager.executeQuery(queryFn, queryName);
}
