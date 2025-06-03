import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { customers } from "./customers";
import { loyaltyPrograms } from "./loyaltyPrograms"; // Import loyaltyPrograms

export const loyaltyMembers = pgTable("loyalty_members", {
  id: serial("id").primaryKey(),
  programId: integer("program_id").references(() => loyaltyPrograms.id).notNull(), // Added programId
  customerId: integer("customer_id").references(() => customers.id).notNull(),
  loyaltyId: text("loyalty_id").notNull().unique(),
  tierId: integer("tier_id"), // FK to loyaltyTiers, define in future
  points: integer("points").notNull().default(0),
  joinDate: timestamp("join_date").notNull().defaultNow(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

export type LoyaltyMember = typeof loyaltyMembers.$inferSelect;
export type NewLoyaltyMember = typeof loyaltyMembers.$inferInsert;
