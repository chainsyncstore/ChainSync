/**
 * Database Migration Runner
 * 
 * This module provides a framework for running and tracking database migrations.
 * It ensures schema consistency between code and the actual database.
 */

import { sql } from 'drizzle-orm';
import { db, dbManager } from '../../../db';
import { getLogger } from '../../../src/logging';

const logger = getLogger().child({ component: 'migration-runner' });

// Define migration types
export type MigrationFn = () => Promise<void>;

export interface Migration {
  up: MigrationFn;
  down: MigrationFn;
}

export interface MigrationRecord {
  id: number;
  name: string;
  executedAt: Date;
  success: boolean;
}

/**
 * Create the migrations table if it doesn't exist
 */
async function ensureMigrationsTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      success BOOLEAN NOT NULL DEFAULT TRUE
    )
  `);
  logger.info('Migrations table initialized');
}

/**
 * Get all executed migrations from the database
 */
async function getExecutedMigrations(): Promise<MigrationRecord[]> {
  await ensureMigrationsTable();
  
  const result = await db.execute<MigrationRecord>(sql`
    SELECT id, name, executed_at as "executedAt", success
    FROM migrations
    ORDER BY id ASC
  `);
  
  // Convert query result to the expected array type
  return result.rows as MigrationRecord[];
}

/**
 * Record a migration in the database
 */
async function recordMigration(name: string, success: boolean): Promise<void> {
  await db.execute(sql`
    INSERT INTO migrations (name, success)
    VALUES (${name}, ${success})
  `);
}

/**
 * Run all pending migrations
 */
export async function runMigrations(migrations: Record<string, Migration>): Promise<void> {
  logger.info('Starting migrations');
  
  const executedMigrations = await getExecutedMigrations();
  const executedNames = new Set(executedMigrations.map(m => m.name));
  
  // Get pending migrations
  const pendingMigrations = Object.entries(migrations)
    .filter(([name]) => !executedNames.has(name))
    .sort(([a], [b]) => a.localeCompare(b)); // Sort by name
  
  if (pendingMigrations.length === 0) {
    logger.info('No pending migrations');
    return;
  }
  
  logger.info(`Found ${pendingMigrations.length} pending migrations`);
  
  // Run each pending migration
  for (const [name, migration] of pendingMigrations) {
    logger.info(`Running migration: ${name}`);
    
    try {
      await migration.up();
      await recordMigration(name, true);
      logger.info(`Migration successful: ${name}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Migration failed: ${name}`, { error: errorMessage });
      await recordMigration(name, false);
      throw new Error(`Migration failed: ${name} - ${errorMessage}`);
    }
  }
  
  logger.info('Migrations completed successfully');
}

/**
 * Rollback the last executed migration
 */
export async function rollbackLastMigration(migrations: Record<string, Migration>): Promise<void> {
  const executedMigrations = await getExecutedMigrations();
  
  if (executedMigrations.length === 0) {
    logger.info('No migrations to rollback');
    return;
  }
  
  const lastMigration = executedMigrations[executedMigrations.length - 1];
  const migrationToRollback = migrations[lastMigration.name];
  
  if (!migrationToRollback) {
    throw new Error(`Cannot find migration to rollback: ${lastMigration.name}`);
  }
  
  logger.info(`Rolling back migration: ${lastMigration.name}`);
  
  try {
    await migrationToRollback.down();
    await db.execute(sql`
      DELETE FROM migrations
      WHERE name = ${lastMigration.name}
    `);
    logger.info(`Rollback successful: ${lastMigration.name}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Rollback failed: ${lastMigration.name}`, { error: errorMessage });
    throw new Error(`Rollback failed: ${lastMigration.name} - ${errorMessage}`);
  }
}

/**
 * Validate database schema against code definitions
 */
export async function validateSchema(): Promise<{ valid: boolean; mismatches: string[] }> {
  logger.info('Validating database schema');
  
  // Get current tables from the database
  const dbTables = await db.execute<{ table_name: string }>(sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
  `);
  
  const dbTableNames = new Set(dbTables.rows.map(t => t.table_name));
  
  // Get table definitions from code
  // This is a simplified approach - in a real implementation, you would
  // introspect your Drizzle schema definitions to get the expected tables
  const expectedTables = [
    'migrations',
    'loyalty_programs',
    'loyalty_tiers',
    'loyalty_members',
    'loyalty_transactions',
    'loyalty_rewards',
    'users',
    'stores',
    'customers',
    'products',
    'orders',
    'order_items'
  ];
  
  // Find missing tables
  const missingTables = expectedTables.filter(table => !dbTableNames.has(table));
  
  // TODO: In a more comprehensive implementation, also check column definitions,
  // types, constraints, etc.
  
  const valid = missingTables.length === 0;
  
  if (valid) {
    logger.info('Schema validation successful');
  } else {
    logger.warn('Schema validation failed', { missingTables });
  }
  
  return { 
    valid, 
    mismatches: missingTables.map(table => `Missing table: ${table}`) 
  };
}

/**
 * Generate a migration file for Drizzle Kit
 */
export async function generateMigration(name: string): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
  const fileName = `${timestamp}_${name}`;
  
  logger.info(`Generating migration: ${fileName}`);
  
  // TODO: In a real implementation, use Drizzle Kit to generate migration
  // This is a placeholder
  
  return fileName;
}
