import { sql } from 'drizzle-orm';

import { getLogger } from '../../shared/logging.js';
import { db } from '../connection-manager.js';

const logger = getLogger('db-migrations').child({ component: 'db-migrations' });

/**
 * Adds strategic indexes to improve query performance
 * This migration adds indexes to frequently queried columns
 */
export async function addPerformanceIndexes() {
  logger.info('Starting database index migration');

  try {
    // Transaction table indexes
    logger.info('Creating indexes for transactions');
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON transactions (customer_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions (created_at);
      CREATE INDEX IF NOT EXISTS idx_transactions_store_id_created_at ON transactions (store_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions (status);
    `);

    // Transaction items indexes
    logger.info('Creating indexes for transaction items');
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction_id ON transaction_items (transaction_id);
      CREATE INDEX IF NOT EXISTS idx_transaction_items_product_id ON transaction_items (product_id);
    `);

    // Inventory indexes
    logger.info('Creating indexes for inventory');
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON inventory (product_id);
      CREATE INDEX IF NOT EXISTS idx_inventory_store_id_product_id ON inventory (store_id, product_id);
      CREATE INDEX IF NOT EXISTS idx_inventory_minimum_level ON inventory (minimum_level) WHERE minimum_level > total_quantity;
    `);

    // Inventory batches indexes
    logger.info('Creating indexes for inventory batches');
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_inventory_batches_inventory_id ON inventory_batches (inventory_id);
      CREATE INDEX IF NOT EXISTS idx_inventory_batches_expiry_date ON inventory_batches (expiry_date);
      CREATE INDEX IF NOT EXISTS idx_inventory_batches_batch_number ON inventory_batches (batch_number);
    `);

    // Users indexes
    logger.info('Creating indexes for users');
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_users_store_id ON users (store_id);
      CREATE INDEX IF NOT EXISTS idx_users_role_active ON users (role, is_active);
      CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));
    `);

    // Products indexes
    logger.info('Creating indexes for products');
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_products_category_id ON products (category_id);
      CREATE INDEX IF NOT EXISTS idx_products_price ON products (price);
      CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin (name gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS idx_products_barcode ON products (barcode);
    `);

    // Loyalty indexes
    logger.info('Creating indexes for loyalty system');
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_loyalty_members_customer_id ON loyalty_members (customer_id);
      CREATE INDEX IF NOT EXISTS idx_loyalty_members_loyalty_id ON loyalty_members (loyalty_id);
      CREATE INDEX IF NOT EXISTS idx_loyalty_members_store_id ON loyalty_members (store_id);
      CREATE INDEX IF NOT EXISTS idx_loyalty_members_tier_id ON loyalty_members (tier_id);
      CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_member_id ON loyalty_transactions (member_id);
      CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_transaction_id ON loyalty_transactions (transaction_id);
    `);

    // Add full-text search capabilities
    logger.info('Creating text search indexes');
    await db.execute(sql`
      -- Make sure the pg_trgm extension is available for text search
      CREATE EXTENSION IF NOT EXISTS pg_trgm;
      
      -- Create text search indexes for common search fields
      CREATE INDEX IF NOT EXISTS idx_products_description_trgm ON products USING gin (description gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS idx_customers_name_trgm ON customers USING gin (full_name gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS idx_customers_email_trgm ON customers USING gin (email gin_trgm_ops);
    `);

    logger.info('Database index migration completed successfully');
    return { success: true };
  } catch (error) {
    logger.error('Failed to add performance indexes', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
