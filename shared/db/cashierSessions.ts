import { pgTable, serial, integer, text, timestamp } from 'drizzle-orm/pg-core';

import { stores } from './stores.js';
import { users } from './users.js';

export const cashierSessions = pgTable('cashier_sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  storeId: integer('store_id')
    .references(() => stores.id)
    .notNull(),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time'),
  status: text('status').notNull(), // e.g., "active", "closed"
  totalSales: text('total_sales').notNull().default('0.00'),
  transactionCount: integer('transaction_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
