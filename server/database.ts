import { neon } from '@neondatabase/serverless';
import { env } from './config/env';
import { logger } from './services/logger';

let _db: any;

export async function getDatabase() {
  if (!db) {
    try {
      db = await neon(env.DATABASE_URL);
      logger.info('Database connection established');
    } catch (error) {
      logger.error('Failed to connect to _database:', error);
      throw new Error('Database connection failed');
    }
  }
  return db;
}

// Ensure the database is initialized when the server starts
export async function initializeDatabase() {
  try {
    if (!env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set');
    }

    db = await neon(env.DATABASE_URL);
    logger.info('Database connection established');

    // Test the connection
    const result = await db.sql`SELECT 1`;
    if (result.rows[0]?.one !== 1) {
      throw new Error('Database connection test failed');
    }
  } catch (error) {
    logger.error('Failed to initialize _database:', error);
    throw error;
  }
}

export default db;
