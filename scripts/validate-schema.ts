#!/usr/bin/env node
/**
 * Schema Validation Utility
 *
 * This script validates the database schema against the code definitions
 * and reports any inconsistencies.
 *
 * Usage:
 *   npm run db:schema:check
 */

import chalk from 'chalk';

import { validateSchema } from '../server/db/migrations/runner';
import { getLogger } from '../src/logging';

const logger = getLogger().child({ component: 'schema-validator' });

async function main() {
  try {
    console.log(chalk.blue('\n🔍 Validating database schema against code definitions...\n'));

    const { valid, mismatches } = await validateSchema();

    if (valid) {
      console.log(chalk.green('✅ Schema validation successful!'));
      console.log(chalk.green('   Database schema matches code definitions.\n'));
      process.exit(0);
    } else {
      console.log(chalk.red('❌ Schema validation failed!'));
      console.log(chalk.red('   Found inconsistencies between database and code definitions:\n'));

      mismatches.forEach((mismatch, index) => {
        console.log(chalk.yellow(`   ${index + 1}. ${mismatch}`));
      });

      console.log(chalk.blue('\n💡 To fix these issues, run:'));
      console.log(chalk.blue('   npm run db:schema:fix\n'));

      process.exit(1);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Schema validation failed with an error', { error: errorMessage });
    console.error(chalk.red(`\n❌ Schema validation error: ${errorMessage}\n`));
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error(chalk.red('Unhandled error:'), error);
  process.exit(1);
});
