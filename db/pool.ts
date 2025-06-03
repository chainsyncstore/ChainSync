// db/pool.ts
import { Pool } from 'pg';
import { getLogger } from '../shared/logging.js';

const logger = getLogger().child({ component: 'db-pool' });

// Create a singleton pool to be shared by all database operations
let pool: Pool | null = null;

/**
 * Initialize the database connection pool
 * This should be called once during application startup
 */
export function initializePool(): Pool {
  if (pool) {
    return pool;
  }

  logger.info('Initializing database connection pool');

  // Get database configuration from environment
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    const error = new Error('DATABASE_URL environment variable not set');
    logger.error('Database configuration error', { error });
    throw error;
  }

  // Create pool with configuration from environment
  pool = new Pool({
    connectionString,
    max: parseInt(process.env.DB_POOL_SIZE || '10', 10),
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000', 10),
    // Add additional configuration as needed
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  // Log connection events
  pool.on('connect', () => {
    logger.debug('New client connected to database pool');
  });

  pool.on('error', (err) => {
    logger.error('Unexpected error on idle database client', { error: err });
  });

  // Add custom properties for monitoring
  Object.defineProperties(pool, {
    totalCount: {
      get: function() {
        return (this as Pool).totalCount;
      }
    },
    idleCount: {
      get: function() {
        return (this as Pool).idleCount;
      }
    },
    waitingCount: {
      get: function() {
        return (this as Pool).waitingCount;
      }
    }
  });

  logger.info('Database connection pool initialized successfully');
  return pool;
}

/**
 * Get the database connection pool
 * If the pool hasn't been initialized, it will be initialized
 */
export function getPool(): Pool {
  if (!pool) {
    return initializePool();
  }
  return pool;
}

/**
 * Close the database connection pool
 * Should be called when shutting down the application
 */
export async function closePool(): Promise<void> {
  if (pool) {
    logger.info('Closing database connection pool');
    await pool.end();
    pool = null;
    logger.info('Database connection pool closed');
  }
}

/**
 * Get a database client from the pool for performing transactions
 * Make sure to release the client when done!
 */
export async function getClient() {
  if (!pool) {
    initializePool();
  }
  
  const client = await pool!.connect();
  
  // Monkey-patch the release method to add logging
  const originalRelease = client.release;
  client.release = () => {
    logger.debug('Client returned to pool');
    return originalRelease.call(client);
  };
  
  return client;
}

// Export the Pool type for type checking in other files
export { Pool };
