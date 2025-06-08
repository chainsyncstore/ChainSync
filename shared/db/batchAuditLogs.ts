import { pgTable, serial, integer, text, jsonb, timestamp } from 'drizzle-orm/pg-core';

import { users } from './users.js';

export const batchAuditLogs = pgTable('batch_audit_logs', {
  id: serial('id').primaryKey(),
  batchId: integer('batch_id').notNull(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  action: text('action').notNull(),
  details: jsonb('details'),
  quantityBefore: integer('quantity_before'),
  quantityAfter: integer('quantity_after'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
