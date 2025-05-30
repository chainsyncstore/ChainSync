import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { customers } from "./customers";

export const loyaltyMembers = pgTable("loyalty_members", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customers.id).notNull(),
  loyaltyId: text("loyalty_id").notNull().unique(),
  tierId: integer("tier_id"), // FK to loyaltyTiers, define in future
  points: integer("points").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
