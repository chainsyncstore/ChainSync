// server/db/connection.ts
// This file ensures that any parts of the server attempting to import a DB connection
// from this specific path receive the correctly configured PostgreSQL Drizzle instance
// from the central db management in the root 'db' folder.

import { db, pool } from '../../db';
import * as schema from '../../shared/schema';

export { db, pool, schema };
