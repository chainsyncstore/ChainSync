import { pgTable, serial, text, integer, timestamp, decimal } from 'drizzle-orm/pg-core';

import { loyaltyMembers } from './loyaltyMembers';
import { loyaltyRewards } from './loyaltyRewards';
import { transactions } from './transactions';

export const loyaltyTransactions = pgTable('loyalty_transactions', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .references(() => loyaltyMembers.id)
    .notNull(),
  transactionId: integer('transaction_id').references(() => transactions.transactionId),
  rewardId: integer('reward_id').references(() => loyaltyRewards.id),
  type: text('type').notNull(), // earn, redeem, adjust, expire
  points: integer('points').notNull(),
  description: text('description'),
  referenceId: text('reference_id'),
  status: text('status').notNull().default('completed'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'),
});

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type NewLoyaltyTransaction = typeof loyaltyTransactions.$inferInsert;
