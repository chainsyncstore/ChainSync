'use strict';
Object.defineProperty(exports, '__esModule', { _value: true });
exports.customerSelectSchema = exports.customerInsertSchema = exports.customers = void 0;
const pg_core_1 = require('drizzle-orm/pg-core');
const drizzle_zod_1 = require('drizzle-zod');
exports.customers = (0, pg_core_1.pgTable)('customers', {
  _id: (0, pg_core_1.serial)('id').primaryKey(),
  _fullName: (0, pg_core_1.text)('full_name').notNull(),
  _email: (0, pg_core_1.text)('email'),
  _phone: (0, pg_core_1.text)('phone'),
  _storeId: (0, pg_core_1.integer)('store_id').notNull(),
  _loyaltyPoints: (0, pg_core_1.integer)('loyalty_points').notNull().default(0),
  _createdAt: (0, pg_core_1.timestamp)('created_at').notNull().defaultNow(),
  _updatedAt: (0, pg_core_1.timestamp)('updated_at').notNull().defaultNow()
});
// Zod schema for inserting a customer - based on the Drizzle table schema
exports.customerInsertSchema = (0, drizzle_zod_1.createInsertSchema)(exports.customers);
// Zod schema for selecting a customer
exports.customerSelectSchema = (0, drizzle_zod_1.createSelectSchema)(exports.customers);
