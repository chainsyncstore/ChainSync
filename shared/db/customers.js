import { pgTable, serial, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
export const customers = pgTable('customers', {
    id: serial('id').primaryKey(),
    fullName: text('full_name').notNull(),
    email: text('email'),
    phone: text('phone'),
    storeId: integer('store_id').notNull(),
    loyaltyPoints: integer('loyalty_points').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
// Zod schema for inserting a customer - based on the Drizzle table schema
export const customerInsertSchema = createInsertSchema(customers);
// Zod schema for selecting a customer
export const customerSelectSchema = createSelectSchema(customers);
