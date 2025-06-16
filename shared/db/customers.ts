import { pgTable, serial, text, boolean, timestamp, integer } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { baseInsertSchema, baseSelectSchema } from './base';

export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  phone: text('phone'),
  // loyaltyEnabled: boolean("loyalty_enabled").notNull().default(true), // This seems to be from an older version or mixed with users table
  // loyaltyPoints: integer("loyalty_points").notNull().default(0), // This seems to be from an older version or mixed with users table
  // storeId is missing, but often customers are associated with a store. Assuming it might be added or handled differently.
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Zod schema for inserting a customer - based on the Drizzle table schema
export const customerInsertSchema = (
  createInsertSchema(customers, {
    email: schema => schema.email({ message: 'Invalid email address' }),
    name: schema => schema.min(2, { message: 'Name must be at least 2 characters' }),
    phone: schema => schema.optional(), // Making phone optional
  }).omit({
    id: true, // Exclude auto-generated fields
    createdAt: true,
    updatedAt: true,
  })
) as unknown as z.Schema;

// Zod schema for selecting a customer
export const customerSelectSchema = createSelectSchema(customers) as z.Schema;

export type Customer = z.infer<typeof customerSelectSchema>;
export type CustomerInsert = z.infer<typeof customerInsertSchema>;
