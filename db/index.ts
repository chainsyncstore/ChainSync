import * as schema from '@shared/schema';

import { dbManager, executeQuery } from './connection-manager.js';

// Minimal db stub for TypeScript compatibility
export const db = {
  execute: async (query: any) => ({ rows: [] }),
  transaction: async (fn: any) => fn({ execute: async (q: any) => ({ rows: [] }) }),
};

// Re-export db instance from the connection manager
export { executeQuery, dbManager };

// Export schemas to maintain compatibility with existing code
export { schema };
