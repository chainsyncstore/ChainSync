import { mysqlTable, int, varchar, text, boolean, datetime, decimal, MySqlTableWithColumns } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

// Create a reusable datetime with default value to now
const timestampWithDefault = () => datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`);

export const schema = {
  loyaltyPrograms: mysqlTable('loyalty_programs', {
    id: int('id').primaryKey().autoincrement(),
    storeId: int('store_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: datetime('updated_at')
  }),

  loyaltyTiers: mysqlTable('loyalty_tiers', {
    id: int('id').primaryKey().autoincrement(),
    programId: int('program_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    pointsRequired: decimal('points_required', { precision: 10, scale: 2 }).notNull(),
    multiplier: decimal('multiplier', { precision: 5, scale: 2 }).notNull(),
    createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: datetime('updated_at')
  }),

  loyaltyMembers: mysqlTable('loyalty_members', {
    id: int('id').primaryKey().autoincrement(),
    programId: int('program_id').notNull(),
    customerId: int('customer_id').notNull(),
    tierId: int('tier_id'),
    loyaltyId: varchar('loyalty_id', { length: 50 }).notNull(),
    points: decimal('points', { precision: 10, scale: 2 }).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    enrolledBy: int('enrolled_by').notNull(),
    enrolledAt: datetime('enrolled_at').notNull(),
    updatedAt: datetime('updated_at')
  }),

  loyaltyTransactions: mysqlTable('loyalty_transactions', {
    id: int('id').primaryKey().autoincrement(),
    memberId: int('member_id').notNull(),
    programId: int('program_id').notNull(),
    transactionId: int('transaction_id'),
    rewardId: int('reward_id'),
    type: varchar('type', { length: 20 }).notNull(),
    points: decimal('points', { precision: 10, scale: 2 }).notNull(),
    userId: int('user_id').notNull(),
    createdAt: datetime('created_at').notNull().defaultNow()
  }),

  loyaltyRewards: mysqlTable('loyalty_rewards', {
    id: int('id').primaryKey().autoincrement(),
    programId: int('program_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    pointsCost: decimal('points_cost', { precision: 10, scale: 2 }).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: datetime('updated_at')
  })
};
