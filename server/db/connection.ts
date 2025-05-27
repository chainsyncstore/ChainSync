// server/db/connection.ts
// This file ensures that any parts of the server attempting to import a DB connection
// from this specific path receive the correctly configured PostgreSQL Drizzle instance
// from the central db management in the root 'db' folder.

import { db, executeQuery, dbManager, schema } from '../../db'; // Adjust path if db/index.ts is elsewhere

export { db, executeQuery, dbManager, schema };
