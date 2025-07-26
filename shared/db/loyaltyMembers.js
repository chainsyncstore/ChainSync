"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loyaltyMemberInsertSchema = exports.loyaltyMemberSelectSchema = exports.loyaltyMembers = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_zod_1 = require("drizzle-zod");
const zod_1 = require("zod");
const customers_1 = require("./customers");
const schema_1 = require("../schema"); // Import loyaltyPrograms from main schema
exports.loyaltyMembers = (0, pg_core_1.pgTable)('loyalty_members', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    programId: (0, pg_core_1.integer)('program_id')
        .references(() => schema_1.loyaltyPrograms.id)
        .notNull(), // Added programId
    customerId: (0, pg_core_1.integer)('customer_id')
        .references(() => customers_1.customers.id)
        .notNull(),
    loyaltyId: (0, pg_core_1.text)('loyalty_id').notNull().unique(),
    tierId: (0, pg_core_1.integer)('tier_id'), // FK to loyaltyTiers, define in future
    points: (0, pg_core_1.integer)('points').notNull().default(0),
    joinDate: (0, pg_core_1.timestamp)('join_date').notNull().defaultNow(),
    status: (0, pg_core_1.text)('status').notNull().default('active'),
    createdAt: (0, pg_core_1.timestamp)('created_at').notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').notNull().defaultNow(),
});
// Zod schema for selecting a loyalty member
exports.loyaltyMemberSelectSchema = (0, drizzle_zod_1.createSelectSchema)(exports.loyaltyMembers);
// Zod schema for inserting a loyalty member
exports.loyaltyMemberInsertSchema = ((0, drizzle_zod_1.createInsertSchema)(exports.loyaltyMembers, {
    loyaltyId: zod_1.z.string().min(1, { message: 'Loyalty ID cannot be empty' }),
    status: zod_1.z.enum(['active', 'inactive', 'suspended', 'cancelled'], {
        errorMap: () => ({ message: 'Invalid status value for loyalty member.' }),
    }),
}).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
}));
