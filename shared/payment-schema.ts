import { pgTable, text, decimal, jsonb, serial, timestamp, integer, boolean, unique } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { relations } from 'drizzle-orm';
import { z } from 'zod';

// Payment Status Tracking
export const paymentStatus = pgTable('payment_status', {
  reference: text('reference').primaryKey(),
  status: text('status').notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').notNull(),
  provider: text('provider').notNull(),
  metadata: jsonb('metadata').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Payment Analytics
export const paymentAnalytics = pgTable('payment_analytics', {
  id: serial('id').primaryKey(),
  reference: text('reference').notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').notNull(),
  provider: text('provider').notNull(),
  success: boolean('success').notNull(),
  metadata: jsonb('metadata').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull()
});

// Payment Refunds
export const paymentRefunds = pgTable('payment_refunds', {
  id: serial('id').primaryKey(),
  originalReference: text('original_reference').references(() => paymentStatus.reference).notNull(),
  refundReference: text('refund_reference').notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').notNull(),
  status: text('status').notNull().default('pending'),
  reason: text('reason'),
  metadata: jsonb('metadata').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Payment Webhook Events
export const paymentWebhooks = pgTable('payment_webhooks', {
  id: serial('id').primaryKey(),
  reference: text('reference').notNull(),
  provider: text('provider').notNull(),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload').notNull(),
  processed: boolean('processed').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// Relations
export const paymentStatusRelations = relations(paymentStatus, ({ many }) => ({
  analytics: many(paymentAnalytics),
  refunds: many(paymentRefunds),
  webhooks: many(paymentWebhooks)
}));

export const paymentRefundsRelations = relations(paymentRefunds, ({ one }) => ({
  originalPayment: one(paymentStatus, {
    fields: [paymentRefunds.originalReference],
    references: [paymentStatus.reference]
  })
}));

export const paymentWebhooksRelations = relations(paymentWebhooks, ({ one }) => ({
  payment: one(paymentStatus, {
    fields: [paymentWebhooks.reference],
    references: [paymentStatus.reference]
  })
}));

// Schemas for validation
export const paymentStatusSchema = createInsertSchema(paymentStatus);
export const paymentAnalyticsSchema = createInsertSchema(paymentAnalytics);
export const paymentRefundsSchema = createInsertSchema(paymentRefunds);
export const paymentWebhooksSchema = createInsertSchema(paymentWebhooks);
