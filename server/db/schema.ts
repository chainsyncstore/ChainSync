import { pgTable, serial, integer, varchar, text, boolean, timestamp, decimal } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Create a reusable timestamp with default value to now for PostgreSQL
const timestampWithDefault = (name: string) => timestamp(name, { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`);

export const schema = {
  loyaltyPrograms: pgTable('loyalty_programs', {
    id: serial('id').primaryKey(),
    storeId: integer('store_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp('updated_at', { mode: 'date' })
  }),

  loyaltyTiers: pgTable('loyalty_tiers', {
    id: serial('id').primaryKey(),
    programId: integer('program_id').notNull(), // Assuming foreign key, add .references(() => schema.loyaltyPrograms.id) if needed
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    pointsRequired: decimal('points_required', { precision: 10, scale: 2 }).notNull(),
    multiplier: decimal('multiplier', { precision: 5, scale: 2 }).notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp('updated_at', { mode: 'date' })
  }),

  loyaltyMembers: pgTable('loyalty_members', {
    id: serial('id').primaryKey(),
    programId: integer('program_id').notNull(), // Assuming foreign key
    customerId: integer('customer_id').notNull(), // Assuming foreign key
    tierId: integer('tier_id'), // Assuming foreign key
    loyaltyId: varchar('loyalty_id', { length: 50 }).notNull().unique(), // Added unique constraint
    points: decimal('points', { precision: 10, scale: 2 }).notNull().default('0'),
    isActive: boolean('is_active').default(true).notNull(),
    enrolledBy: integer('enrolled_by').notNull(), // Assuming foreign key to users table
    enrolledAt: timestamp('enrolled_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp('updated_at', { mode: 'date' })
  }),

  loyaltyTransactions: pgTable('loyalty_transactions', {
    id: serial('id').primaryKey(),
    memberId: integer('member_id').notNull(), // Assuming foreign key
    programId: integer('program_id').notNull(), // Assuming foreign key
    transactionId: integer('transaction_id'), // Assuming foreign key to an orders/transactions table
    rewardId: integer('reward_id'), // Assuming foreign key
    type: varchar('type', { length: 20 }).notNull(), // e.g., 'earn', 'redeem', 'adjust'
    points: decimal('points', { precision: 10, scale: 2 }).notNull(),
    userId: integer('user_id').notNull(), // User who performed/authorized transaction
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`)
  }),

  loyaltyRewards: pgTable('loyalty_rewards', {
    id: serial('id').primaryKey(),
    programId: integer('program_id').notNull(), // Assuming foreign key
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp('updated_at', { mode: 'date' })
  })
  // Add other tables (users, stores, customers, products, orders, order_items) here
  // using pgTable and pg-core types.
};
