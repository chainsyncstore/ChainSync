import { pgTable, serial, integer, text, timestamp, boolean } from 'drizzle-orm/pg-core';

import { affiliates } from './affiliates.js';
import { users } from './users.js';

export const referrals = pgTable('referrals', {
  id: serial('id').primaryKey(),
  affiliateId: integer('affiliate_id')
    .references(() => affiliates.id)
    .notNull(),
  referredUserId: integer('referred_user_id').references(() => users.id),
  status: text('status').notNull(), // e.g., 'pending', 'active', 'expired'
  discountApplied: boolean('discount_applied').default(false),
  commissionPaid: boolean('commission_paid').default(false),
  signupDate: timestamp('signup_date'),
  activationDate: timestamp('activation_date'),
  expiryDate: timestamp('expiry_date'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(), // Added updatedAt
});
