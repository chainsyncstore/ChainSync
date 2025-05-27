// test/factories/db.ts
// Drizzle ORM SQLite in-memory test DB instance for integration tests
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '../../shared/schema';

// Create in-memory SQLite database
const sqlite = new Database(':memory:');

// Export Drizzle instance with all schema tables (including customers)
export const db = drizzle(sqlite, { schema });

// Export tables for convenience
export const { customers, users, stores, products, categories, inventory, inventoryBatches, transactions, transactionItems, subscriptions } = schema;
