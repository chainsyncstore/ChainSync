import { pgTable, serial, integer, text, timestamp } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { customers } from './customers';
import { loyaltyPrograms } from './loyaltyPrograms'; // Import loyaltyPrograms
export const loyaltyMembers = pgTable('loyalty_members', {
    id: serial('id').primaryKey(),
    programId: integer('program_id')
        .references(() => loyaltyPrograms.id)
        .notNull(), // Added programId
    customerId: integer('customer_id')
        .references(() => customers.id)
        .notNull(),
    loyaltyId: text('loyalty_id').notNull().unique(),
    tierId: integer('tier_id'), // FK to loyaltyTiers, define in future
    points: integer('points').notNull().default(0),
    joinDate: timestamp('join_date').notNull().defaultNow(),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
// Zod schema for selecting a loyalty member
export const loyaltyMemberSelectSchema = createSelectSchema(loyaltyMembers);
// Zod schema for inserting a loyalty member
export const loyaltyMemberInsertSchema = (createInsertSchema(loyaltyMembers, {
    loyaltyId: z.string().min(1, { message: 'Loyalty ID cannot be empty' }),
    status: z.enum(['active', 'inactive', 'suspended', 'cancelled'], {
        errorMap: () => ({ message: 'Invalid status value for loyalty member.' }),
    }),
}).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
}));
//# sourceMappingURL=loyaltyMembers.js.map