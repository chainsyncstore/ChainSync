// server/database.ts
import { AppError, ErrorCode, ErrorCategory } from '@shared/types/errors';
// This file ensures that any parts of the server attempting to import a DB connection
// from this path receive the correctly configured PostgreSQL Drizzle instance
// from the central db management in the root 'db' folder.

// Re-export the db instance and other necessary utilities from the main db/index.ts
// The path '../../db' assumes server/database.ts is in server/ and db/index.ts is in the root db/ folder.
// If server/database.ts is in server/db/, then it would be '../../db'.
// Given the project structure, server/database.ts is likely at the root of /server.
// So, the path to the root /db folder is '../db'.

import { db, executeQuery, dbManager, schema } from '../db';

export { db, executeQuery, dbManager, schema };

// The original neon-specific code below is now superseded by the Drizzle setup in db/connection-manager.ts
/*
import { neon } from '@neondatabase/serverless';
import { env } from './config/env';
import { logger } from './services/logger'; // This logger might also need to be the central one

let db: unknown;

export async function getDatabase() {
  if (!db) {
    try {
      db = await neon(env.DATABASE_URL);
      logger.info('Database connection established');
    } catch (error: unknown) {
      logger.error('Failed to connect to database:', error);
      throw new Error('Database connection failed');
    }
  }
  return db;
}

export async function initializeDatabase() {
  try {
    if (!env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set');
    }
    
    db = await neon(env.DATABASE_URL);
    logger.info('Database connection established');
    
    const result = await db.sql`SELECT 1`;
    if (result.rows[0]?.one !== 1) {
      throw new Error('Database connection test failed');
    }
  } catch (error: unknown) {
    logger.error('Failed to initialize database:', error);
    throw error instanceof AppError ? error : new AppError('Unexpected error', 'system', 'UNKNOWN_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

export default db;
*/
