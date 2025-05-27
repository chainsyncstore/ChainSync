import { dbManager, db, executeQuery } from './connection-manager';
import * as schema from "@shared/schema";

// Re-export db instance from the connection manager
export { db, executeQuery, dbManager };

// Export schemas to maintain compatibility with existing code
export { schema };