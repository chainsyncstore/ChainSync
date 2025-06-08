import { schema as actualDbSchema } from '@shared/db/index.js'; // Use comprehensive schema with relations
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { getLogger } from '../src/logging/index.js'; // Assuming logger is accessible

const logger = getLogger().child({ component: 'database-init' });

// Database connection pool
export const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: parseInt(process.env.DB_POOL_SIZE || '10', 10),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000', 10),
});

dbPool.on('connect', () => {
  logger.info('Database pool connected');
});

dbPool.on('error', err => {
  logger.error('Unexpected error on idle client', { error: err });
  // process.exit(-1); // Consider if critical errors should terminate
});

// Create Drizzle db instance
export const db: NodePgDatabase<typeof actualDbSchema> = drizzle(dbPool, {
  schema: actualDbSchema,
  logger: process.env.NODE_ENV !== 'production' ? true : false,
});

logger.info('Database pool and Drizzle ORM initialized.');
