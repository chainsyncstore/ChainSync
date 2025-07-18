/**
 * Database Migration for Schema Standardization
 * 
 * This migration standardizes field names across the database to follow
 * the new naming conventions defined in our schema style guide.
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Standardize loyalty module field names
  await db.schema
    .alterTable('loyalty_tiers')
    .renameColumn('required_points', 'required_points')
    .renameColumn('active', 'is_active')
    .execute();

  await db.schema
    .alterTable('loyalty_members')
    .renameColumn('active', 'is_active')
    .execute();

  // Standardize refund/return module field names
  // Since 'refunds' table is actually named 'returns' in the code
  await db.schema
    .alterTable('refunds')
    .renameColumn('refund_id', 'reference_id')
    .renameColumn('total', 'refund_amount')
    .execute();

  // Standardize subscription module field names
  await db.schema
    .alterTable('subscriptions')
    .addColumn('end_date', sql`timestamp with time zone`)
    .addColumn('is_active', sql`boolean DEFAULT true`)
    .execute();

  // Add missing timestamps to ensure consistency
  await db.schema
    .alterTable('loyalty_transactions')
    .addColumn('updated_at', sql`timestamp with time zone`)
    .execute();

  // Add consistent boolean defaults
  await db.schema
    .alterTable('customers')
    .alterColumn('is_active', (col) => col.setDefault(true))
    .execute();

  // Standardize timestamps across all tables to include updated_at
  const tables = [
    'loyalty_rewards',
    'return_reasons',
    'inventory',
    'inventory_batches'
  ];

  for (const table of tables) {
    await db.schema
      .alterTable(table)
      .addColumn('updated_at', sql`timestamp with time zone`)
      .execute();
  }
}

export async function down(db: Kysely<any>): Promise<void> {
  // Revert loyalty module field names
  await db.schema
    .alterTable('loyalty_tiers')
    .renameColumn('required_points', 'required_points')
    .renameColumn('is_active', 'active')
    .execute();

  await db.schema
    .alterTable('loyalty_members')
    .renameColumn('is_active', 'active')
    .execute();

  // Revert refund/return module field names
  await db.schema
    .alterTable('refunds')
    .renameColumn('reference_id', 'refund_id')
    .renameColumn('refund_amount', 'total')
    .execute();

  // Revert subscription module field names
  await db.schema
    .alterTable('subscriptions')
    .dropColumn('end_date')
    .dropColumn('is_active')
    .execute();

  // Revert timestamp additions
  await db.schema
    .alterTable('loyalty_transactions')
    .dropColumn('updated_at')
    .execute();

  // Revert boolean default changes
  await db.schema
    .alterTable('customers')
    .alterColumn('is_active', (col) => col.dropDefault())
    .execute();

  // Revert timestamp additions across tables
  const tables = [
    'loyalty_rewards',
    'return_reasons',
    'inventory',
    'inventory_batches'
  ];

  for (const table of tables) {
    await db.schema
      .alterTable(table)
      .dropColumn('updated_at')
      .execute();
  }
}
