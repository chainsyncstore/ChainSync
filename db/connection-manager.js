'use strict';
const __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
  if (k2 === undefined) k2 = k;
  let desc = Object.getOwnPropertyDescriptor(m, k);
  if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
    desc = { _enumerable: true, _get: function() { return m[k]; } };
  }
  Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
  if (k2 === undefined) k2 = k;
  o[k2] = m[k];
}));
const __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
  Object.defineProperty(o, 'default', { _enumerable: true, _value: v });
}) : function(o, v) {
  o['default'] = v;
});
const __importStar = (this && this.__importStar) || (function() {
  let ownKeys = function(o) {
    ownKeys = Object.getOwnPropertyNames || function(o) {
      const ar = [];
      for (const k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
      return ar;
    };
    return ownKeys(o);
  };
  return function(mod) {
    if (mod && mod.__esModule) return mod;
    const result = {};
    if (mod != null) for (let k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== 'default') __createBinding(result, mod, k[i]);
    __setModuleDefault(result, mod);
    return result;
  };
})();
Object.defineProperty(exports, '__esModule', { _value: true });
exports.db = exports.dbManager = void 0;
exports.executeQuery = executeQuery;
const pg_1 = require('pg');
const schema = __importStar(require('@shared/schema'));
const node_postgres_1 = require('drizzle-orm/node-postgres');
const logging_1 = require('../shared/logging');
const logger = (0, logging_1.getLogger)('db-connection-manager').child({ _component: 'db-connection-manager' });
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
  constructor() {
    this.isInitialized = false;
    this.connectionMetrics = {
      _totalConnections: 0,
      _activeConnections: 0,
      _idleConnections: 0,
      _waitingClients: 0,
      _queryCount: 0,
      _queryTimes: []
    };
    this.slowQueryThreshold = 1000; // 1 second
    this.initializePool();
  }
  static getInstance() {
    if (!DbConnectionManager.instance) {
      DbConnectionManager.instance = new DbConnectionManager();
    }
    return DbConnectionManager.instance;
  }
  initializePool() {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    // Determine pool size based on environment
    const poolSize = process.env.DB_POOL_SIZE
      ? parseInt(process.env.DB_POOL_SIZE, 10)
      : DEFAULT_POOL_SIZE;
    // Create connection pool with optimized settings
    this.pool = new pg_1.Pool({
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
    this.drizzleDb = (0, node_postgres_1.drizzle)(this.pool, { schema }); // Pass pool directly
    this.isInitialized = true;
    logger.info('Database connection pool initialized', {
      poolSize,
      _idleTimeoutMs: CONNECTION_IDLE_TIMEOUT_MS
    });
  }
  /**
     * Get the Drizzle database instance
     */
  getDb() {
    if (!this.isInitialized) {
      this.initializePool();
    }
    return this.drizzleDb;
  }
  /**
     * Execute a database query with performance tracking
     */
  async executeQuery(queryFn, queryName = 'unnamed-query') {
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
    }
    catch (error) {
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
  async getPoolStats() {
    const poolStats = await this.pool.query('SELECT count(*) as total FROM pg_stat_activity');
    const waitingClients = this.pool.waitingCount;
    const avgQueryTime = this.connectionMetrics.queryTimes.length > 0
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
  async shutdown() {
    logger.info('Shutting down database connection pool');
    await this.pool.end();
    this.isInitialized = false;
  }
}
// Export singleton instance
exports.dbManager = DbConnectionManager.getInstance();
exports.db = exports.dbManager.getDb();
// Export a helper function for executing queries with tracking
async function executeQuery(queryFn, queryName = 'unnamed-query') {
  return exports.dbManager.executeQuery(queryFn, queryName);
}
