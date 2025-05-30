/**
 * Migrations Index
 * 
 * This file registers all migrations in the correct order.
 * New migrations should be added to this file.
 */

import * as initialSchema from './001_initial_schema';
import * as addLoyaltyPrograms from './002_add_loyalty_programs';
import * as addIndexes from './003_add_indexes';

// Register migrations in chronological order
export const migrations: Record<string, any> = {
  '001_initial_schema': initialSchema,
  '002_add_loyalty_programs': addLoyaltyPrograms,
  '003_add_indexes': addIndexes
};
