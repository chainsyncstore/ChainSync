import { pgTable, serial, text, integer, timestamp, decimal } from "drizzle-orm/pg-core";
import { loyaltyPrograms } from "./loyaltyPrograms";

export const loyaltyTiers = pgTable("loyalty_tiers", {
  id: serial("id").primaryKey(),
  programId: integer("program_id").references(() => loyaltyPrograms.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  pointThreshold: integer("point_threshold").notNull().default(0),
  benefits: text("benefits"),
  discountPercentage: decimal("discount_percentage"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

export type LoyaltyTier = typeof loyaltyTiers.$inferSelect;
export type NewLoyaltyTier = typeof loyaltyTiers.$inferInsert;
