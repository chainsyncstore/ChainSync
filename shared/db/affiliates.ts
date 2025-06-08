import { pgTable, serial, integer, text, timestamp } from 'drizzle-orm/pg-core';

import { users } from './users.js';

export const affiliates = pgTable('affiliates', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  code: text('code').notNull().unique(),
  totalReferrals: integer('total_referrals').default(0).notNull(),
  totalEarnings: text('total_earnings').default('0').notNull(), // Storing as text to handle potential precision with currency
  pendingEarnings: text('pending_earnings').default('0').notNull(), // Storing as text
  bankName: text('bank_name'),
  accountNumber: text('account_number'),
  accountName: text('account_name'),
  bankCode: text('bank_code'),
  paymentMethod: text('payment_method'), // e.g., 'paystack', 'flutterwave'
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
