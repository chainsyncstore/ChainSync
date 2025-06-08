/**
 * Initial Schema Migration
 *
 * Creates the core tables for the ChainSync application.
 */

import { sql } from 'drizzle-orm';

import { Migration } from './runner';
import { db } from '../../../db';

export const up: Migration['up'] = async () => {
  // Create users table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP
    )
  `);

  // Create stores table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS stores (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(50),
      address TEXT,
      timezone VARCHAR(50) NOT NULL,
      country VARCHAR(2) NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP
    )
  `);

  // Create customers table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      store_id INTEGER NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(50),
      address TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id)
    )
  `);

  // Create products table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      store_id INTEGER NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      sku VARCHAR(100) NOT NULL,
      price DECIMAL(10, 2) NOT NULL,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id)
    )
  `);

  // Create orders table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      store_id INTEGER NOT NULL,
      customer_id INTEGER NOT NULL,
      order_number VARCHAR(50) NOT NULL UNIQUE,
      status VARCHAR(50) NOT NULL,
      total_amount DECIMAL(10, 2) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )
  `);

  // Create order_items table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price DECIMAL(10, 2) NOT NULL,
      total_price DECIMAL(10, 2) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);
};

export const down: Migration['down'] = async () => {
  // Drop tables in reverse order of creation to respect foreign key constraints
  await db.execute(sql`DROP TABLE IF EXISTS order_items`);
  await db.execute(sql`DROP TABLE IF EXISTS orders`);
  await db.execute(sql`DROP TABLE IF EXISTS products`);
  await db.execute(sql`DROP TABLE IF EXISTS customers`);
  await db.execute(sql`DROP TABLE IF EXISTS stores`);
  await db.execute(sql`DROP TABLE IF EXISTS users`);
};
