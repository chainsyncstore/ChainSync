import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { db } from '../db'; // Assuming db/index.ts which exports the Drizzle instance
import { sql } from 'drizzle-orm';
import { DrizzleAdapter } from '@db/drizzle-adapter'; // Using path alias

const execAsync = promisify(exec);

/**
 * Database Migration Manager for Blue-Green Deployments
 * 
 * This utility ensures safe database migrations during blue-green deployments
 * by managing schema changes in a backward-compatible way.
 */
class DbMigrationManager {
  private adapter: DrizzleAdapter;
  private migrationDir: string;
  private lockTimeout: number = 60000; // 1 minute lock timeout
  private lockKey: string = 'db_migration_lock';
  private migrationTableName: string = 'schema_migrations';

  constructor(migrationDir: string = '../db/migrations') {
    this.adapter = new DrizzleAdapter(db);
    this.migrationDir = path.resolve(__dirname, migrationDir);
  }

  /**
   * Checks if migrations are needed by comparing available vs applied migrations
   */
  async checkMigrationsNeeded(): Promise<boolean> {
    const appliedMigrations = await this.getAppliedMigrations();
    const availableMigrations = await this.getAvailableMigrations();
    
    const pendingMigrations = availableMigrations.filter(
      migration => !appliedMigrations.includes(migration)
    );
    
    return pendingMigrations.length > 0;
  }

  /**
   * Gets list of migrations that have been applied to the database
   */
  async getAppliedMigrations(): Promise<string[]> {
    try {
      // Check if migration table exists
      const tableExists = await this.adapter.tableExists(this.migrationTableName);
      
      if (!tableExists) {
        console.log(`Migration table '${this.migrationTableName}' does not exist yet`);
        return [];
      }
      
      // Specify the expected row type for the query result
      const result = await db.execute<{ migration_name: string }>(
        sql`SELECT migration_name FROM ${sql.raw(this.migrationTableName)} ORDER BY executed_at ASC`
      );
      
      return result.rows.map(row => row.migration_name);
    } catch (error) {
      console.error('Error fetching applied migrations:', error);
      return [];
    }
  }

  /**
   * Gets list of available migration files
   */
  async getAvailableMigrations(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.migrationDir);
      return files
        .filter(file => file.endsWith('.ts') || file.endsWith('.js'))
        .map(file => path.parse(file).name)
        .sort();
    } catch (error) {
      console.error('Error reading migration directory:', error);
      return [];
    }
  }

  /**
   * Acquires a lock before performing migrations to prevent concurrent migrations
   */
  async acquireLock(): Promise<boolean> {
    try {
      // Using Redis would be better for distributed locking
      // This is a simplified example using the database
      const result = await db.execute(sql`
        INSERT INTO locks (key, acquired_at, expires_at)
        VALUES (${this.lockKey}, NOW(), NOW() + interval '${this.lockTimeout} milliseconds')
        ON CONFLICT (key) DO NOTHING
        RETURNING key
      `);
      
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error acquiring migration lock:', error);
      return false;
    }
  }

  /**
   * Releases the migration lock
   */
  async releaseLock(): Promise<boolean> {
    try {
      await db.execute(sql`DELETE FROM locks WHERE key = ${this.lockKey}`);
      return true;
    } catch (error) {
      console.error('Error releasing migration lock:', error);
      return false;
    }
  }

  /**
   * Performs database migrations in a safe manner for blue-green deployments
   * This ensures backward compatibility by following these rules:
   * 1. Only additive changes (new tables, columns) are allowed initially
   * 2. Removals happen in a later deployment after code no longer references old schema
   */
  async migrateDatabase(): Promise<boolean> {
    console.log('Checking if migrations are needed...');
    
    if (!await this.checkMigrationsNeeded()) {
      console.log('No migrations needed');
      return true;
    }
    
    console.log('Migrations needed. Acquiring lock...');
    
    if (!await this.acquireLock()) {
      console.error('Could not acquire migration lock. Another process may be migrating.');
      return false;
    }
    
    try {
      console.log('Running migrations...');
      
      // Create migration table if it doesn't exist
      await this.ensureMigrationTableExists();
      
      const appliedMigrations = await this.getAppliedMigrations();
      const availableMigrations = await this.getAvailableMigrations();
      
      for (const migration of availableMigrations) {
        if (!appliedMigrations.includes(migration)) {
          try {
            console.log(`Applying migration: ${migration}`);
            
            // Execute migration
            await this.executeMigration(migration);
            
            // Record migration
            await db.execute(sql`
              INSERT INTO ${sql.raw(this.migrationTableName)} (migration_name, executed_at) 
              VALUES (${migration}, NOW())
            `);
            
            console.log(`Migration ${migration} applied successfully`);
          } catch (error) {
            console.error(`Error applying migration ${migration}:`, error);
            throw error;
          }
        }
      }
      
      console.log('All migrations applied successfully');
      return true;
    } catch (error) {
      console.error('Migration failed:', error);
      return false;
    } finally {
      await this.releaseLock();
      console.log('Migration lock released');
    }
  }

  /**
   * Ensures the migration tracking table exists
   */
  private async ensureMigrationTableExists(): Promise<void> {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ${sql.raw(this.migrationTableName)} (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP NOT NULL,
        UNIQUE(migration_name)
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS locks (
        key VARCHAR(255) PRIMARY KEY,
        acquired_at TIMESTAMP NOT NULL,
        expires_at TIMESTAMP NOT NULL
      )
    `);
  }

  /**
   * Executes a specific migration
   */
  private async executeMigration(migrationName: string): Promise<void> {
    const migrationPath = path.join(this.migrationDir, `${migrationName}`);
    
    try {
      // For TypeScript migrations, we need to compile and then execute
      if (migrationName.endsWith('.ts')) {
        await execAsync(`npx ts-node ${migrationPath}.ts`);
      } else {
        // For JavaScript migrations, we can require directly
        const migration = require(migrationPath);
        
        if (typeof migration.up === 'function') {
          await migration.up(db);
        } else if (typeof migration.default === 'function') {
          await migration.default(db);
        } else {
          throw new Error(`Migration ${migrationName} does not export an 'up' or 'default' function`);
        }
      }
    } catch (error) {
      console.error(`Error executing migration ${migrationName}:`, error);
      throw error;
    }
  }
  
  /**
   * Validates migration backward compatibility
   * This checks for potentially breaking schema changes
   */
  async validateMigrationCompatibility(): Promise<{valid: boolean, issues: string[]}> {
    const issues: string[] = [];
    const availableMigrations = await this.getAvailableMigrations();
    
    for (const migration of availableMigrations) {
      const migrationPath = path.join(this.migrationDir, `${migration}`);
      let migrationContent: string;
      
      try {
        migrationContent = await fs.readFile(`${migrationPath}.ts`, 'utf8');
      } catch (error) {
        try {
          migrationContent = await fs.readFile(`${migrationPath}.js`, 'utf8');
        } catch (innerError) {
          issues.push(`Could not read migration file: ${migration}`);
          continue;
        }
      }
      
      // Check for potentially breaking changes
      // This is a simplified check - in a real scenario, you'd want a more comprehensive analysis
      if (migrationContent.includes('DROP TABLE') || 
          migrationContent.includes('DROP COLUMN') ||
          migrationContent.includes('ALTER COLUMN') && 
          (migrationContent.includes('TYPE') || migrationContent.includes('NOT NULL'))) {
        issues.push(`Migration ${migration} contains potentially breaking changes`);
      }
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  }
}

export const migrationManager = new DbMigrationManager();

// CLI interface for running from command line
if (require.main === module) {
  const command = process.argv[2] || 'migrate';
  
  async function main() {
    switch (command) {
      case 'check':
        const needed = await migrationManager.checkMigrationsNeeded();
        console.log(needed ? 'Migrations needed' : 'No migrations needed');
        process.exit(needed ? 1 : 0);
        break;
        
      case 'validate':
        const validation = await migrationManager.validateMigrationCompatibility();
        if (validation.valid) {
          console.log('All migrations are backward compatible');
          process.exit(0);
        } else {
          console.error('Migration compatibility issues found:');
          validation.issues.forEach(issue => console.error(`- ${issue}`));
          process.exit(1);
        }
        break;
        
      case 'migrate':
        const success = await migrationManager.migrateDatabase();
        process.exit(success ? 0 : 1);
        break;
        
      default:
        console.error('Unknown command. Use: check, validate, or migrate');
        process.exit(1);
    }
  }
  
  main().catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
}
