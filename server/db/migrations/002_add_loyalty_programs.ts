/**
 * Add Loyalty Programs Migration
 *
 * Creates tables for the loyalty program feature.
 */

import { sql } from 'drizzle-orm';

import { Migration } from './runner';
import { db } from '../../../db';

export const up: Migration['up'] = async () => {
  // Create loyalty_programs table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS loyalty_programs (
      id SERIAL PRIMARY KEY,
      store_id INTEGER NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id)
    )
  `);

  // Create loyalty_tiers table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS loyalty_tiers (
      id SERIAL PRIMARY KEY,
      program_id INTEGER NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      points_required DECIMAL(10, 2) NOT NULL,
      multiplier DECIMAL(5, 2) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP,
      FOREIGN KEY (program_id) REFERENCES loyalty_programs(id)
    )
  `);

  // Create loyalty_members table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS loyalty_members (
      id SERIAL PRIMARY KEY,
      program_id INTEGER NOT NULL,
      customer_id INTEGER NOT NULL,
      tier_id INTEGER,
      loyalty_id VARCHAR(50) NOT NULL,
      points DECIMAL(10, 2) NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      enrolled_by INTEGER NOT NULL,
      enrolled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP,
      FOREIGN KEY (program_id) REFERENCES loyalty_programs(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (tier_id) REFERENCES loyalty_tiers(id),
      FOREIGN KEY (enrolled_by) REFERENCES users(id)
    )
  `);

  // Create loyalty_rewards table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS loyalty_rewards (
      id SERIAL PRIMARY KEY,
      program_id INTEGER NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      points_required DECIMAL(10, 2) NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      type VARCHAR(50) NOT NULL,
      metadata JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP,
      FOREIGN KEY (program_id) REFERENCES loyalty_programs(id)
    )
  `);

  // Create loyalty_transactions table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS loyalty_transactions (
      id SERIAL PRIMARY KEY,
      member_id INTEGER NOT NULL,
      program_id INTEGER NOT NULL,
      transaction_id INTEGER,
      reward_id INTEGER,
      type VARCHAR(20) NOT NULL,
      points DECIMAL(10, 2) NOT NULL,
      notes TEXT,
      user_id INTEGER NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (member_id) REFERENCES loyalty_members(id),
      FOREIGN KEY (program_id) REFERENCES loyalty_programs(id),
      FOREIGN KEY (transaction_id) REFERENCES orders(id),
      FOREIGN KEY (reward_id) REFERENCES loyalty_rewards(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
};

export const down: Migration['down'] = async () => {
  // Drop tables in reverse order of creation to respect foreign key constraints
  await db.execute(sql`DROP TABLE IF EXISTS loyalty_transactions`);
  await db.execute(sql`DROP TABLE IF EXISTS loyalty_rewards`);
  await db.execute(sql`DROP TABLE IF EXISTS loyalty_members`);
  await db.execute(sql`DROP TABLE IF EXISTS loyalty_tiers`);
  await db.execute(sql`DROP TABLE IF EXISTS loyalty_programs`);
};
