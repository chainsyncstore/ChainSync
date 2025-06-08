/**
 * Add Indexes Migration
 *
 * Adds performance indexes to frequently queried columns.
 */

import { sql } from 'drizzle-orm';

import { Migration } from './runner';
import { db } from '../../../db';

export const up: Migration['up'] = async () => {
  // Add indexes for foreign keys and frequently queried columns

  // Stores
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_stores_is_active ON stores(is_active)`);

  // Customers
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_customers_store_id ON customers(store_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email)`);

  // Products
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active)`);

  // Orders
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_orders_store_id ON orders(store_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)`);

  // Order Items
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id)`
  );

  // Loyalty Programs
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_loyalty_programs_store_id ON loyalty_programs(store_id)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_loyalty_programs_is_active ON loyalty_programs(is_active)`
  );

  // Loyalty Tiers
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_loyalty_tiers_program_id ON loyalty_tiers(program_id)`
  );

  // Loyalty Members
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_loyalty_members_program_id ON loyalty_members(program_id)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_loyalty_members_customer_id ON loyalty_members(customer_id)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_loyalty_members_tier_id ON loyalty_members(tier_id)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_loyalty_members_loyalty_id ON loyalty_members(loyalty_id)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_loyalty_members_is_active ON loyalty_members(is_active)`
  );

  // Loyalty Rewards
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_program_id ON loyalty_rewards(program_id)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_is_active ON loyalty_rewards(is_active)`
  );

  // Loyalty Transactions
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_member_id ON loyalty_transactions(member_id)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_program_id ON loyalty_transactions(program_id)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_transaction_id ON loyalty_transactions(transaction_id)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_reward_id ON loyalty_transactions(reward_id)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_created_at ON loyalty_transactions(created_at)`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_type ON loyalty_transactions(type)`
  );
};

export const down: Migration['down'] = async () => {
  // Drop indexes

  // Stores
  await db.execute(sql`DROP INDEX IF EXISTS idx_stores_is_active`);

  // Customers
  await db.execute(sql`DROP INDEX IF EXISTS idx_customers_store_id`);
  await db.execute(sql`DROP INDEX IF EXISTS idx_customers_email`);

  // Products
  await db.execute(sql`DROP INDEX IF EXISTS idx_products_store_id`);
  await db.execute(sql`DROP INDEX IF EXISTS idx_products_sku`);
  await db.execute(sql`DROP INDEX IF EXISTS idx_products_is_active`);

  // Orders
  await db.execute(sql`DROP INDEX IF EXISTS idx_orders_store_id`);
  await db.execute(sql`DROP INDEX IF EXISTS idx_orders_customer_id`);
  await db.execute(sql`DROP INDEX IF EXISTS idx_orders_status`);
  await db.execute(sql`DROP INDEX IF EXISTS idx_orders_created_at`);

  // Order Items
  await db.execute(sql`DROP INDEX IF EXISTS idx_order_items_order_id`);
  await db.execute(sql`DROP INDEX IF EXISTS idx_order_items_product_id`);

  // Loyalty Programs
  await db.execute(sql`DROP INDEX IF EXISTS idx_loyalty_programs_store_id`);
  await db.execute(sql`DROP INDEX IF EXISTS idx_loyalty_programs_is_active`);

  // Loyalty Tiers
  await db.execute(sql`DROP INDEX IF EXISTS idx_loyalty_tiers_program_id`);

  // Loyalty Members
  await db.execute(sql`DROP INDEX IF EXISTS idx_loyalty_members_program_id`);
  await db.execute(sql`DROP INDEX IF EXISTS idx_loyalty_members_customer_id`);
  await db.execute(sql`DROP INDEX IF EXISTS idx_loyalty_members_tier_id`);
  await db.execute(sql`DROP INDEX IF EXISTS idx_loyalty_members_loyalty_id`);
  await db.execute(sql`DROP INDEX IF EXISTS idx_loyalty_members_is_active`);

  // Loyalty Rewards
  await db.execute(sql`DROP INDEX IF EXISTS idx_loyalty_rewards_program_id`);
  await db.execute(sql`DROP INDEX IF EXISTS idx_loyalty_rewards_is_active`);

  // Loyalty Transactions
  await db.execute(sql`DROP INDEX IF EXISTS idx_loyalty_transactions_member_id`);
  await db.execute(sql`DROP INDEX IF EXISTS idx_loyalty_transactions_program_id`);
  await db.execute(sql`DROP INDEX IF EXISTS idx_loyalty_transactions_transaction_id`);
  await db.execute(sql`DROP INDEX IF EXISTS idx_loyalty_transactions_reward_id`);
  await db.execute(sql`DROP INDEX IF EXISTS idx_loyalty_transactions_created_at`);
  await db.execute(sql`DROP INDEX IF EXISTS idx_loyalty_transactions_type`);
};
