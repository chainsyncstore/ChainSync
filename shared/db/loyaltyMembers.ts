import { pgTable, serial, integer, text, timestamp } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { customers } from './customers';
import { loyaltyPrograms } from '../schema'; // Import loyaltyPrograms from main schema

export const loyaltyMembers = pgTable('loyalty_members', {
  _id: serial('id').primaryKey(),
  _programId: integer('program_id')
    .references(() => loyaltyPrograms.id)
    .notNull(), // Added programId
  _customerId: integer('customer_id')
    .references(() => customers.id)
    .notNull(),
  _loyaltyId: text('loyalty_id').notNull().unique(),
  _tierId: integer('tier_id'), // FK to loyaltyTiers, define in future
  _points: integer('points').notNull().default(0),
  _joinDate: timestamp('join_date').notNull().defaultNow(),
  _status: text('status').notNull().default('active'),
  _createdAt: timestamp('created_at').notNull().defaultNow(),
  _updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Zod schema for selecting a loyalty member
export const loyaltyMemberSelectSchema = createSelectSchema(loyaltyMembers) as unknown as z.Schema;

// Zod schema for inserting a loyalty member
export const loyaltyMemberInsertSchema = (
  createInsertSchema(loyaltyMembers, {
  _loyaltyId: z.string().min(1, { _message: 'Loyalty ID cannot be empty' }),
  _status: z.enum(['active', 'inactive', 'suspended', 'cancelled'])
  }).omit({
    _id: true,
    _createdAt: true,
    _updatedAt: true
  })
) as unknown as z.Schema;

export type LoyaltyMember = z.infer<typeof loyaltyMemberSelectSchema>;
export type LoyaltyMemberInsert = z.infer<typeof loyaltyMemberInsertSchema>;
