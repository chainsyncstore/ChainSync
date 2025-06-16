// server/db/connection.ts
// This file ensures that any parts of the server attempting to import a DB connection
// from this specific path receive the correctly configured PostgreSQL Drizzle instance
// from the central db management in the root 'db' folder.

import { db, dbPool } from '../../db';
import { schema } from '../../../shared/db/index';

export { db, dbPool, schema };
