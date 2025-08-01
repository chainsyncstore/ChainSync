import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "../shared/schema.js";
import { customers } from '../shared/db/customers';

// This is the correct way neon config - DO NOT change this
neonConfig.webSocketConstructor = ws;

// For development/testing, use a dummy URL if DATABASE_URL is not set
const databaseUrl = process.env.DATABASE_URL || 'postgresql://dummy:dummy@localhost:5432/dummy';

const combinedSchema = { ...schema, customers };

export const pool = new Pool({ connectionString: databaseUrl });
export const db = drizzle({ client: pool, schema: combinedSchema });

// Re-export all tables so consumers can `import { db, customers, transactions } from "../../db"`.
export * from '../shared/schema.js';
export { customers } from '../shared/db/customers';
