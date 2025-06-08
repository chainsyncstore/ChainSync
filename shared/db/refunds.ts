import { pgTable, serial, integer, decimal, text, timestamp } from 'drizzle-orm/pg-core';

import { users } from './users';

export const refunds = pgTable('refunds', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  amount: decimal('amount').notNull(),
  status: text('status').notNull(),
  method: text('method'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
