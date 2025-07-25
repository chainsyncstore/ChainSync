import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema.js";
import { customers } from '../shared/db/customers';

// This is the correct way neon config - DO NOT change this
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set. Did you forget to provision a database?');
}

const combinedSchema = { ...schema, customers };

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema: combinedSchema });

// Re-export all tables so consumers can `import { db, customers, transactions } from "../../db"`.
export * from '@shared/schema.js';
export { customers } from '../shared/db/customers';
