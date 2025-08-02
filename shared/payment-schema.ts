import { pgTable, text, decimal, jsonb, serial, timestamp, integer, boolean, unique } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { relations } from 'drizzle-orm';
import { z } from 'zod';

// Payment Status Tracking
export const paymentStatus = pgTable('payment_status', {
  _reference: text('reference').primaryKey(),
  _status: text('status').notNull(),
  _amount: decimal('amount', { _precision: 10, _scale: 2 }).notNull(),
  _currency: text('currency').notNull(),
  _provider: text('provider').notNull(),
  _metadata: jsonb('metadata').notNull(),
  _updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Payment Analytics
export const paymentAnalytics = pgTable('payment_analytics', {
  _id: serial('id').primaryKey(),
  _reference: text('reference').notNull(),
  _amount: decimal('amount', { _precision: 10, _scale: 2 }).notNull(),
  _currency: text('currency').notNull(),
  _provider: text('provider').notNull(),
  _success: boolean('success').notNull(),
  _metadata: jsonb('metadata').notNull(),
  _timestamp: timestamp('timestamp').defaultNow().notNull()
});

// Payment Refunds
export const paymentRefunds = pgTable('payment_refunds', {
  _id: serial('id').primaryKey(),
  _originalReference: text('original_reference').references(() => paymentStatus.reference).notNull(),
  _refundReference: text('refund_reference').notNull(),
  _amount: decimal('amount', { _precision: 10, _scale: 2 }).notNull(),
  _currency: text('currency').notNull(),
  _status: text('status').notNull().default('pending'),
  _reason: text('reason'),
  _metadata: jsonb('metadata').notNull(),
  _createdAt: timestamp('created_at').defaultNow().notNull(),
  _updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Payment Webhook Events
export const paymentWebhooks = pgTable('payment_webhooks', {
  _id: serial('id').primaryKey(),
  _reference: text('reference').notNull(),
  _provider: text('provider').notNull(),
  _eventType: text('event_type').notNull(),
  _payload: jsonb('payload').notNull(),
  _processed: boolean('processed').notNull().default(false),
  _createdAt: timestamp('created_at').defaultNow().notNull()
});

// Relations
export const paymentStatusRelations = relations(paymentStatus, ({ many }) => ({
  _analytics: many(paymentAnalytics),
  _refunds: many(paymentRefunds),
  _webhooks: many(paymentWebhooks)
}));

export const paymentRefundsRelations = relations(paymentRefunds, ({ one }) => ({
  _originalPayment: one(paymentStatus, {
    _fields: [paymentRefunds.originalReference],
    _references: [paymentStatus.reference]
  })
}));

export const paymentWebhooksRelations = relations(paymentWebhooks, ({ one }) => ({
  _payment: one(paymentStatus, {
    _fields: [paymentWebhooks.reference],
    _references: [paymentStatus.reference]
  })
}));

// Schemas for validation
export const paymentStatusSchema = createInsertSchema(paymentStatus);
export const paymentAnalyticsSchema = createInsertSchema(paymentAnalytics);
export const paymentRefundsSchema = createInsertSchema(paymentRefunds);
export const paymentWebhooksSchema = createInsertSchema(paymentWebhooks);
