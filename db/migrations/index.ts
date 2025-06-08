import { addPerformanceIndexes } from './add-indexes';
import { getLogger } from '../../shared/logging';
import { dbManager } from '../connection-manager';

const logger = getLogger('db-migrations-runner').child({ component: 'db-migrations-runner' });

/**
 * Runs all database migrations in the correct order
 */
export async function runMigrations() {
  logger.info('Starting database migrations');

  try {
    // Add performance indexes
    const indexResult = await addPerformanceIndexes();
    if (!indexResult.success) {
      logger.error('Failed to add performance indexes', {
        error: indexResult.error,
      });
    }

    // Add more migrations here as needed

    logger.info('All migrations completed');
    return { success: true };
  } catch (error) {
    logger.error('Migration failed', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    // We don't want to shut down the connection pool in normal operation
    // Only shut it down when explicitly running migrations as a standalone process
    if (process.env.MIGRATION_STANDALONE === 'true') {
      await dbManager.shutdown();
    }
  }
}
