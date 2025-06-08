#!/usr/bin/env node
/**
 * Database Migration Runner Script
 *
 * This script runs database migrations and validates schema consistency.
 * Usage:
 *   npm run migrate -- [--validate-only]
 *   npm run migrate:validate
 */

import { migrations } from '../server/db/migrations';
import { runMigrations, validateSchema } from '../server/db/migrations/runner';
import { getLogger } from '../src/logging';

const logger = getLogger().child({ component: 'migration-script' });

async function main() {
  const validateOnly = process.argv.includes('--validate-only');

  try {
    // Validate schema consistency between code and database
    logger.info('Validating schema consistency...');
    const { valid, mismatches } = await validateSchema();

    if (!valid) {
      logger.error('Schema validation failed', { mismatches });
      console.error('\nSchema validation failed with the following issues:');
      mismatches.forEach(mismatch => console.error(`- ${mismatch}`));

      if (validateOnly) {
        process.exit(1);
      }

      console.warn('\nProceeding with migrations despite schema inconsistencies...');
    } else {
      logger.info('Schema validation successful');
      console.log('Schema validation successful. Database is consistent with code definitions.');

      if (validateOnly) {
        process.exit(0);
      }
    }

    // Run migrations
    logger.info('Running migrations...');
    await runMigrations(migrations);

    logger.info('Migration process completed successfully');
    console.log('Migrations completed successfully.');
    process.exit(0);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Migration process failed', { error: errorMessage });
    console.error(`\nMigration failed: ${errorMessage}`);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
