import { pgTable, serial, text, boolean, timestamp, integer } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { baseInsertSchema, baseSelectSchema } from './base';

export const customers = pgTable('customers', {
  _id: serial('id').primaryKey(),
  _fullName: text('full_name').notNull(),
  _email: text('email'),
  _phone: text('phone'),
  _storeId: integer('store_id').notNull(),
  _loyaltyPoints: integer('loyalty_points').notNull().default(0),
  _createdAt: timestamp('created_at').notNull().defaultNow(),
  _updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Zod schema for inserting a customer - based on the Drizzle table schema
export const customerInsertSchema = createInsertSchema(customers);

// Zod schema for selecting a customer
export const customerSelectSchema = createSelectSchema(customers) as z.Schema;

export type Customer = z.infer<typeof customerSelectSchema>;
export type CustomerInsert = z.infer<typeof customerInsertSchema>;
