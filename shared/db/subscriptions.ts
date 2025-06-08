import {
  pgTable,
  serial,
  integer,
  text,
  decimal,
  boolean,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { z } from 'zod';

import { baseTable, baseInsertSchema, baseSelectSchema } from './base.js';
import { users } from './users.js';
import {
  subscriptionToDatabaseFields,
  subscriptionFromDatabaseFields,
} from '../utils/subscription-mapping.js';

// Subscription status and plan enums as text fields
export const subscriptions = pgTable(
  'subscriptions',
  {
    ...baseTable,
    userId: integer('user_id')
      .references(() => users.id)
      .notNull(),
    plan: text('plan').notNull(),
    status: text('status').notNull().default('active'),
    amount: decimal('amount').notNull(),
    currency: text('currency').default('NGN'),
    referralCode: text('referral_code'),
    discountApplied: boolean('discount_applied').default(false),
    discountAmount: decimal('discount_amount').default('0.00'),
    startDate: timestamp('start_date').notNull(),
    endDate: timestamp('end_date').notNull(),
    autoRenew: boolean('auto_renew').default(true),
    paymentProvider: text('payment_provider'),
    paymentReference: text('payment_reference'),
    metadata: jsonb('metadata'),
  },
  table => ({
    userIdIndex: index('subscriptions_user_id_idx').on(table.userId),
    planIndex: index('subscriptions_plan_idx').on(table.plan),
    statusIndex: index('subscriptions_status_idx').on(table.status),
  })
);

// Zod schema for Subscription
export const subscriptionInsertSchema = baseInsertSchema.extend({
  userId: z.number(),
  plan: z.string(),
  status: z.string(),
  amount: z.string(),
  currency: z.string(),
  referralCode: z.string().optional(),
  discountApplied: z.boolean().optional(),
  discountAmount: z.string().optional(),
  startDate: z.date(),
  endDate: z.date(),
  autoRenew: z.boolean().optional(),
  paymentProvider: z.string().optional(),
  paymentReference: z.string().optional(),
  metadata: z.any().optional(),
});

export const subscriptionSelectSchema = baseSelectSchema.extend({
  id: z.number(),
  userId: z.number(),
  plan: z.string(),
  status: z.string(),
  amount: z.string(),
  currency: z.string(),
  referralCode: z.string().optional(),
  discountApplied: z.boolean().optional(),
  discountAmount: z.string().optional(),
  startDate: z.date(),
  endDate: z.date(),
  autoRenew: z.boolean().optional(),
  paymentProvider: z.string().optional(),
  paymentReference: z.string().optional(),
  metadata: z.any().optional(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;

/**
 * Convert a Subscription object to database fields (camelCase to snake_case)
 */
export function toDbFields(subscription: Partial<Subscription>): Record<string, unknown> {
  return subscriptionToDatabaseFields(subscription);
}

/**
 * Convert database fields to a Subscription object (snake_case to camelCase)
 */
export function fromDbFields<T extends Record<string, unknown>>(
  dbSubscription: T
): Partial<Subscription> {
  return subscriptionFromDatabaseFields(dbSubscription);
}

/**
 * Convert an array of database records to Subscription objects
 */
export function mapSubscriptions<T extends Record<string, unknown>>(
  dbSubscriptions: T[]
): Partial<Subscription>[] {
  return dbSubscriptions.map(subscription => fromDbFields(subscription));
}
