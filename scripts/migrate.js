#!/usr/bin/env node
/**
 * Database Migration Script for ChainSync
 *
 * This script manages database migrations for the application.
 * It can create new migrations or run existing ones.
 *
 * Usage:
 *   node migrate.js create <name>    Create a new migration
 *   node migrate.js run              Run all pending migrations
 *   node migrate.js status           Show migration status
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Command line arguments
const args = process.argv.slice(2);
const command = args[0];

// Configuration
const migrationsDir = path.join(__dirname, '../db/migrations');
const migrationHistoryFile = path.join(migrationsDir, 'migration_history.json');

/**
 * Create a new migration file
 */
function createMigration() {
  const name = args[1];
  if (!name) {
    console.error('Migration name is required');
    console.error('Usage: node migrate.js create <name>');
    process.exit(1);
  }

  // Run the TypeScript version
  const result = spawnSync('tsx', [
    path.join(__dirname, '../db/migrations/setup.ts'),
    'create',
    name
  ], { stdio: 'inherit' });

  if (result.status !== 0) {
    console.error('Failed to create migration');
    process.exit(1);
  }
}

/**
 * Run migrations
 */
function runMigrations() {
  console.log('Running database migrations...');

  // Run drizzle-kit migrations using the npm script
  const result = spawnSync('npm', ['run', 'db:migrate'], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'development' }
  });

  if (result.status !== 0) {
    console.error('Migration failed');
    process.exit(1);
  }

  console.log('Migrations completed successfully');
}

/**
 * Show migration status
 */
function showMigrationStatus() {
  console.log('Checking migration status...');

  // Run the TypeScript version to get migration history
  const result = spawnSync('tsx', [
    path.join(__dirname, '../db/migrations/setup.ts'),
    'status'
  ], { stdio: 'inherit' });

  if (result.status !== 0) {
    console.error('Failed to check migration status');
    process.exit(1);
  }
}

/**
 * Main function
 */
function main() {
  // Create migrations directory if it doesn't exist
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
    console.log(`Created migrations directory: ${migrationsDir}`);
  }

  // Process command
  switch (command) {
    case 'create':
      createMigration();
      break;
    case 'run':
      runMigrations();
      break;
    case 'status':
      showMigrationStatus();
      break;
    default:
      console.error('Unknown command:', command);
      console.error('Usage:');
      console.error('  node migrate.js create <name>    Create a new migration');
      console.error('  node migrate.js run              Run all pending migrations');
      console.error('  node migrate.js status           Show migration status');
      process.exit(1);
  }
}

// Run the main function
main();
