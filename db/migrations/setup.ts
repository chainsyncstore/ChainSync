// db/migrations/setup.ts
import fs from 'fs';
import path from 'path';

import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

import { getLogger } from '../../shared/logging.js';
import { db } from '../index.js';

const logger = getLogger('db-migrations').child({ component: 'db-migrations' });

/**
 * Run database migrations
 * This should be called when the application starts
 */
export async function runMigrations(): Promise<void> {
  const migrationsFolder = path.join(__dirname, '../migrations');

  // Check if migrations folder exists
  if (!fs.existsSync(migrationsFolder)) {
    logger.warn(`Migrations folder not found at ${migrationsFolder}`);
    return;
  }

  try {
    logger.info('Running database migrations...');

    // Run migrations
    await migrate(db, { migrationsFolder });

    logger.info('Database migrations completed successfully');
  } catch (error) {
    logger.error(
      'Database migration failed',
      error instanceof Error ? error : new Error(String(error))
    );

    // In production, we might want to exit the process if migrations fail
    if (process.env.NODE_ENV === 'production') {
      logger.error('Exiting due to migration failure in production environment');
      process.exit(1);
    }

    throw error;
  }
}

/**
 * Create a new migration file
 * This is used by the migration script to create a new migration
 *
 * @param name Migration name
 * @returns Path to the created migration file
 */
export function createMigration(name: string): string {
  const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '');
  const migrationName = `${timestamp}_${name.replace(/\s+/g, '_').toLowerCase()}`;
  const migrationsFolder = path.join(__dirname, '../migrations');

  // Create migrations folder if it doesn't exist
  if (!fs.existsSync(migrationsFolder)) {
    fs.mkdirSync(migrationsFolder, { recursive: true });
  }

  // Create migration file
  const migrationPath = path.join(migrationsFolder, `${migrationName}.sql`);

  // Create empty migration file
  fs.writeFileSync(
    migrationPath,
    `-- Migration: ${name}\n-- Created at: ${new Date().toISOString()}\n\n-- Write your SQL migration here\n`
  );

  return migrationPath;
}

/**
 * Apply a specific migration
 * This is used for testing and development
 *
 * @param migrationPath Path to migration file
 */
export async function applyMigration(migrationPath: string): Promise<void> {
  try {
    // Read migration file
    const sqlString = fs.readFileSync(migrationPath, 'utf8');

    // Execute SQL
    await db.execute(sql.raw(sqlString));

    logger.info(`Applied migration: ${path.basename(migrationPath)}`);
  } catch (error) {
    logger.error(
      `Failed to apply migration: ${path.basename(migrationPath)}`,
      error instanceof Error ? error : new Error(String(error))
    );
    throw error;
  }
}

/**
 * Get migration history
 * Returns the list of applied migrations from the database
 */
export async function getMigrationHistory(): Promise<string[]> {
  try {
    // This assumes you have a migrations table
    // You might need to adjust this based on how drizzle stores migration history
    const result = await db.execute(
      sql`SELECT * FROM __drizzle_migrations ORDER BY executed_at DESC`
    );

    return result.rows.map((row: any) => row.migration_name);
  } catch (error) {
    // If the migrations table doesn't exist yet, return empty array
    logger.warn('Failed to get migration history, migrations table might not exist yet');
    return [];
  }
}
