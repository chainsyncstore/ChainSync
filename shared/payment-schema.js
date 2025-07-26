"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentWebhooksSchema = exports.paymentRefundsSchema = exports.paymentAnalyticsSchema = exports.paymentStatusSchema = exports.paymentWebhooksRelations = exports.paymentRefundsRelations = exports.paymentStatusRelations = exports.paymentWebhooks = exports.paymentRefunds = exports.paymentAnalytics = exports.paymentStatus = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_zod_1 = require("drizzle-zod");
const drizzle_orm_1 = require("drizzle-orm");
// Payment Status Tracking
exports.paymentStatus = (0, pg_core_1.pgTable)("payment_status", {
    reference: (0, pg_core_1.text)("reference").primaryKey(),
    status: (0, pg_core_1.text)("status").notNull(),
    amount: (0, pg_core_1.decimal)("amount", { precision: 10, scale: 2 }).notNull(),
    currency: (0, pg_core_1.text)("currency").notNull(),
    provider: (0, pg_core_1.text)("provider").notNull(),
    metadata: (0, pg_core_1.jsonb)("metadata").notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
});
// Payment Analytics
exports.paymentAnalytics = (0, pg_core_1.pgTable)("payment_analytics", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    reference: (0, pg_core_1.text)("reference").notNull(),
    amount: (0, pg_core_1.decimal)("amount", { precision: 10, scale: 2 }).notNull(),
    currency: (0, pg_core_1.text)("currency").notNull(),
    provider: (0, pg_core_1.text)("provider").notNull(),
    success: (0, pg_core_1.boolean)("success").notNull(),
    metadata: (0, pg_core_1.jsonb)("metadata").notNull(),
    timestamp: (0, pg_core_1.timestamp)("timestamp").defaultNow().notNull(),
});
// Payment Refunds
exports.paymentRefunds = (0, pg_core_1.pgTable)("payment_refunds", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    originalReference: (0, pg_core_1.text)("original_reference").references(() => exports.paymentStatus.reference).notNull(),
    refundReference: (0, pg_core_1.text)("refund_reference").notNull(),
    amount: (0, pg_core_1.decimal)("amount", { precision: 10, scale: 2 }).notNull(),
    currency: (0, pg_core_1.text)("currency").notNull(),
    status: (0, pg_core_1.text)("status").notNull().default("pending"),
    reason: (0, pg_core_1.text)("reason"),
    metadata: (0, pg_core_1.jsonb)("metadata").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
});
// Payment Webhook Events
exports.paymentWebhooks = (0, pg_core_1.pgTable)("payment_webhooks", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    reference: (0, pg_core_1.text)("reference").notNull(),
    provider: (0, pg_core_1.text)("provider").notNull(),
    eventType: (0, pg_core_1.text)("event_type").notNull(),
    payload: (0, pg_core_1.jsonb)("payload").notNull(),
    processed: (0, pg_core_1.boolean)("processed").notNull().default(false),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
});
// Relations
exports.paymentStatusRelations = (0, drizzle_orm_1.relations)(exports.paymentStatus, ({ many }) => ({
    analytics: many(exports.paymentAnalytics),
    refunds: many(exports.paymentRefunds),
    webhooks: many(exports.paymentWebhooks),
}));
exports.paymentRefundsRelations = (0, drizzle_orm_1.relations)(exports.paymentRefunds, ({ one }) => ({
    originalPayment: one(exports.paymentStatus, {
        fields: [exports.paymentRefunds.originalReference],
        references: [exports.paymentStatus.reference],
    }),
}));
exports.paymentWebhooksRelations = (0, drizzle_orm_1.relations)(exports.paymentWebhooks, ({ one }) => ({
    payment: one(exports.paymentStatus, {
        fields: [exports.paymentWebhooks.reference],
        references: [exports.paymentStatus.reference],
    }),
}));
// Schemas for validation
exports.paymentStatusSchema = (0, drizzle_zod_1.createInsertSchema)(exports.paymentStatus);
exports.paymentAnalyticsSchema = (0, drizzle_zod_1.createInsertSchema)(exports.paymentAnalytics);
exports.paymentRefundsSchema = (0, drizzle_zod_1.createInsertSchema)(exports.paymentRefunds);
exports.paymentWebhooksSchema = (0, drizzle_zod_1.createInsertSchema)(exports.paymentWebhooks);
