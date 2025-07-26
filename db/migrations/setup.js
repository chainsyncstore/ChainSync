"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrations = runMigrations;
exports.createMigration = createMigration;
exports.applyMigration = applyMigration;
exports.getMigrationHistory = getMigrationHistory;
// db/migrations/setup.ts
const migrator_1 = require("drizzle-orm/postgres-js/migrator");
const drizzle_orm_1 = require("drizzle-orm");
const index_js_1 = require("../index.js");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const index_js_2 = require("../../src/logging/index.js");
const logger = (0, index_js_2.getLogger)().child({ component: 'db-migrations' });
/**
 * Run database migrations
 * This should be called when the application starts
 */
async function runMigrations() {
    const migrationsFolder = path_1.default.join(__dirname, '../migrations');
    // Check if migrations folder exists
    if (!fs_1.default.existsSync(migrationsFolder)) {
        logger.warn(`Migrations folder not found at ${migrationsFolder}`);
        return;
    }
    try {
        logger.info('Running database migrations...');
        // Run migrations
        await (0, migrator_1.migrate)(index_js_1.db, { migrationsFolder });
        logger.info('Database migrations completed successfully');
    }
    catch (error) {
        logger.error('Database migration failed', error instanceof Error ? error : new Error(String(error)));
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
function createMigration(name) {
    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '');
    const migrationName = `${timestamp}_${name.replace(/\s+/g, '_').toLowerCase()}`;
    const migrationsFolder = path_1.default.join(__dirname, '../migrations');
    // Create migrations folder if it doesn't exist
    if (!fs_1.default.existsSync(migrationsFolder)) {
        fs_1.default.mkdirSync(migrationsFolder, { recursive: true });
    }
    // Create migration file
    const migrationPath = path_1.default.join(migrationsFolder, `${migrationName}.sql`);
    // Create empty migration file
    fs_1.default.writeFileSync(migrationPath, `-- Migration: ${name}\n-- Created at: ${new Date().toISOString()}\n\n-- Write your SQL migration here\n`);
    return migrationPath;
}
/**
 * Apply a specific migration
 * This is used for testing and development
 *
 * @param migrationPath Path to migration file
 */
async function applyMigration(migrationPath) {
    try {
        // Read migration file
        const sql = fs_1.default.readFileSync(migrationPath, 'utf8');
        // Execute SQL
        await index_js_1.db.execute(sql);
        logger.info(`Applied migration: ${path_1.default.basename(migrationPath)}`);
    }
    catch (error) {
        logger.error(`Failed to apply migration: ${path_1.default.basename(migrationPath)}`, error instanceof Error ? error : new Error(String(error)));
        throw error;
    }
}
/**
 * Get migration history
 * Returns the list of applied migrations from the database
 */
async function getMigrationHistory() {
    try {
        // This assumes you have a migrations table
        // You might need to adjust this based on how drizzle stores migration history
        const result = await index_js_1.db.execute((0, drizzle_orm_1.sql) `SELECT * FROM __drizzle_migrations ORDER BY executed_at DESC`);
        return result.rows.map((row) => row.migration_name);
    }
    catch (error) {
        // If the migrations table doesn't exist yet, return empty array
        logger.warn('Failed to get migration history, migrations table might not exist yet');
        return [];
    }
}
