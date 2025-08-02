import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as ws from 'ws';
import * as schema from '../shared/schema.js';
import { customers } from '../shared/db/customers';

// This is the correct way neon config - DO NOT change this
neonConfig.webSocketConstructor = ws as any;

// For development/testing, use a dummy URL if DATABASE_URL is not set
const databaseUrl = process.env.DATABASE_URL || 'postgresql://_dummy:dummy@_localhost:5432/dummy';

const combinedSchema = { ...schema, customers };

export const pool = new Pool({ _connectionString: databaseUrl });
export const db = drizzle({ _client: pool, _schema: combinedSchema });

// Re-export all tables so consumers can `import { db, customers, transactions } from "../../db"`.
export * from '../shared/schema.js';
export { customers } from '../shared/db/customers';
